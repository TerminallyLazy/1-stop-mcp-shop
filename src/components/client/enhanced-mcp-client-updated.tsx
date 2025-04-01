"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { callGeminiAPI } from "@/lib/api/gemini";
import { callAnthropicAPI } from "@/lib/api/anthropic";
import { ChatMessage, MCPServer, ToolCall } from "@/lib/types";
import { listMCPServers } from "@/lib/api/mcp";
import { getUserSession } from "@/lib/supabase";
import { ChatContainer } from "./chat-container";
import { processToolCall, createFollowUpPrompt } from "@/lib/utils/tool-handler";

export function EnhancedMCPClientUpdated() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("claude-3-sonnet-20240229");
  const [availableServers, setAvailableServers] = useState<MCPServer[]>([]);
  const [installedServers, setInstalledServers] = useState<MCPServer[]>([]);
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([]);
  const [userSession, setUserSession] = useState<{user: any, subscription?: string}|null>(null);
  const [serverUrl, setServerUrl] = useState<string>("");
  const [configProcessing, setConfigProcessing] = useState<boolean>(false);

  // Fetch user session and available servers
  useEffect(() => {
    const fetchUserAndServers = async () => {
      try {
        // Get user session
        const session = await getUserSession();
        setUserSession(session);
        
        // Fetch available servers
        const servers = await listMCPServers();
        setAvailableServers(servers);
        
        // Get installed servers from local storage
        const storedServers = localStorage.getItem('installedServers');
        if (storedServers) {
          const parsedServers = JSON.parse(storedServers);
          setInstalledServers(parsedServers);
        } else if (servers.length > 0) {
          // If no stored servers, use the first one as default
          setInstalledServers([servers[0]]);
          localStorage.setItem('installedServers', JSON.stringify([servers[0]]));
        }
      } catch (error) {
        console.error("Error initializing client:", error);
      }
    };

    fetchUserAndServers();
  }, []);

  // Helper function to detect tool calls in the assistant response
  const detectToolCalls = (content: string, servers: MCPServer[]): ToolCall[] => {
    const toolCalls: ToolCall[] = [];
    const uniqueToolRequests = new Set<string>();
    
    // MCP-compliant JSON-RPC 2.0 tool call patterns
    // Match both standard XML tags and code blocks with XML tags
    const jsonRpcPattern = /(?:<mcp:tool_call>|```xml\s*<mcp:tool_call>)\s*([\s\S]*?)\s*(?:<\/mcp:tool_call>|<\/mcp:tool_call>\s*```)/gi;
    
    // First try to find structured MCP tool calls
    let jsonRpcMatch;
    while ((jsonRpcMatch = jsonRpcPattern.exec(content)) !== null) {
      try {
        // Extract the JSON part
        const jsonText = jsonRpcMatch[1]?.trim();
        console.log("Found tool call JSON:", jsonText);
        
        if (jsonText) {
          const toolCallData = JSON.parse(jsonText);
          
          // Validate it follows JSON-RPC 2.0 format
          if (toolCallData.jsonrpc === '2.0' && 
              toolCallData.method === 'execute_tool' && 
              toolCallData.params && 
              toolCallData.params.name) {
            
            const toolName = toolCallData.params.name;
            const parameters = toolCallData.params.parameters || {};
            
            // Create a unique key for this tool call to prevent duplicates
            const toolRequestKey = `${toolName}-${JSON.stringify(parameters)}`;
            
            // Skip if we've already seen this exact tool+parameters combination
            if (uniqueToolRequests.has(toolRequestKey)) {
              console.log(`Skipping duplicate tool call: ${toolRequestKey}`);
              continue;
            }
            
            uniqueToolRequests.add(toolRequestKey);
            
            // Find the server that has this tool
            const serverWithTool = servers.find(server => 
              server.tools.some(tool => tool.name === toolName)
            );
            
            if (serverWithTool) {
              toolCalls.push({
                id: toolCallData.id || `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                tool: toolName,
                args: parameters,
                status: 'pending',
                requestKey: toolRequestKey // Add this to track duplicates
              });
            }
          }
        }
      } catch (error) {
        console.error("Error parsing MCP tool call:", error);
      }
    }
    
    // If no structured MCP calls found, fall back to regex pattern matching
    if (toolCalls.length === 0) {
      // Check for common Gemini output patterns like: "tool_name(params)" or "tool_code tool_name(params)"
      // This regex is more flexible to handle Gemini's formatting of tool calls
      const geminiToolPattern = /(?:```(?:tool_code\s+)?|\btool_code\s+)?([a-zA-Z0-9_]+)\s*\(\s*(?:location|query|expression)=(?:"|')([^"']+)(?:"|')\s*\)/gi;
      let geminiMatch;
      
      while ((geminiMatch = geminiToolPattern.exec(content)) !== null) {
        const toolName = geminiMatch[1].trim();
        const paramValue = geminiMatch[2].trim();
        
        // Extract parameter name based on common tools
        let paramName = "query"; // Default
        if (toolName.includes("weather")) {
          paramName = "location";
        } else if (toolName.includes("calculate")) {
          paramName = "expression";
        }
        
        // Find the server that has this tool
        const serverWithTool = servers.find(server => 
          server.tools.some(tool => tool.name === toolName || 
                                   tool.name === `get_${toolName}`)
        );
        
        if (serverWithTool) {
          // Find the exact tool
          const exactToolName = serverWithTool.tools.find(t => 
            t.name === toolName || t.name === `get_${toolName}`
          )?.name || toolName;
          
          // Add the tool call
          toolCalls.push({
            id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            tool: exactToolName,
            args: { [paramName]: paramValue },
            status: 'pending'
          });
        }
      }
      
      // Check for tool call indicators in the message content with Using tool: format
      const toolCallPattern = /Using tool:?\s+([a-zA-Z0-9_]+)\(([^)]*)\)/gi;
      let match;
      
      while ((match = toolCallPattern.exec(content)) !== null) {
        const toolName = match[1];
        const paramsStr = match[2].trim();
        
        // Find the server that has this tool
        const serverWithTool = servers.find(server => 
          server.tools.some(tool => tool.name === toolName)
        );
        
        if (serverWithTool) {
          const tool = serverWithTool.tools.find(t => t.name === toolName);
          
          if (tool) {
            // Parse parameters from the string
            const params: Record<string, string> = {};
            if (paramsStr) {
              const paramPairs = paramsStr.split(',');
              for (const pair of paramPairs) {
                const [key, value] = pair.split('=').map(p => p.trim());
                if (key && value) {
                  // Remove quotes if present
                  params[key] = value.replace(/^["'](.*)["']$/, '$1');
                }
              }
            }
            
            // Add the tool call
            toolCalls.push({
              id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              tool: toolName,
              args: params,
              status: 'pending'
            });
          }
        }
      }
    }
    
    // Weather pattern - as fallback for any weather related queries
    if (toolCalls.length === 0 && 
        content.toLowerCase().includes('weather') && 
        servers.some(server => server.tools.some(tool => 
          tool.name.includes('weather') || tool.name.includes('get_weather')
        ))) {
      
      const weatherServer = servers.find(server => 
        server.tools.some(tool => tool.name.includes('weather') || tool.name.includes('get_weather'))
      );
      
      if (weatherServer) {
        const weatherTool = weatherServer.tools.find(tool => 
          tool.name.includes('weather') || tool.name.includes('get_weather')
        );
        
        if (weatherTool) {
          // Extract location from content using proper patterns
          const locationPatterns = [
            /weather\s+(?:in|for|at)\s+([a-zA-Z0-9\s,\-\.]+)/i,
            /(?:in|for|at)\s+([a-zA-Z0-9\s,\-\.]+)(?:\s+weather)/i,
            /what(?:'s|\s+is)\s+(?:the\s+)?weather\s+(?:in|for|at)\s+([a-zA-Z0-9\s,\-\.]+)/i,
            /([a-zA-Z0-9\s,\-\.]+)\s+weather/i
          ];
          
          let location = "";
          
          // Try each pattern until we find a match
          for (const pattern of locationPatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
              location = match[1].trim();
              break;
            }
          }
          
          // If no location found, try to extract it from the user query in content
          if (!location) {
            const userQueryMatch = content.match(/User message:?\s+(.+?)(?:\.|$)/i);
            if (userQueryMatch && userQueryMatch[1]) {
              // Extract location from user query
              for (const pattern of locationPatterns) {
                const match = userQueryMatch[1].match(pattern);
                if (match && match[1]) {
                  location = match[1].trim();
                  break;
                }
              }
            }
          }
          
          // If we have a location, create a tool call
          if (location) {
            toolCalls.push({
              id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              tool: weatherTool.name,
              args: { location },
              status: 'pending'
            });
          }
        }
      }
    }
    
    return toolCalls;
  };
  
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    
    try {
      // Create a system message with appropriate instructions
      const systemMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: `You have access to the following MCP (Model Context Protocol) servers and tools:
${installedServers.map(server => `
Server: ${server.name}
Description: ${server.description}
Tools: ${server.tools.map(tool => tool.name).join(', ')}

${server.tools.map(tool => `Tool: ${tool.name}
Description: ${tool.description}
Parameters: ${tool.parameters.map(p => `${p.name} (${p.type}${p.required ? ', required' : ''})`).join(', ')}
`).join('\n')}
`).join('\n')}

To use these tools, format your response using the MCP specification:

<mcp:tool_call>
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "execute_tool",
  "params": {
    "name": "tool_name",
    "parameters": {
      "param1": "value1",
      "param2": "value2"
    }
  }
}
</mcp:tool_call>

You can use these tools to retrieve information or take actions for the user. Only use tools that are available based on the list above.

IMPORTANT: After using a tool once, just respond to the information without making additional tool calls. Wait for the user to ask another question before using tools again.
`,
        createdAt: new Date().toISOString()
      };
      
      // Call the appropriate LLM API based on the selected model
      let response;
      if (selectedModel.startsWith('gemini')) {
        // For Gemini, create a simpler user instruction
        const userInstruction: ChatMessage = {
          id: `gemini-context-${Date.now()}`,
          role: 'user',
          content: `You are a helpful assistant that can have natural conversations with users. You can use tools when appropriate to get information needed to answer questions.

Available tools: ${installedServers.map(server => 
            server.tools.map(tool => `${tool.name} - ${tool.description}`).join(', ')
          ).join('. ')}

When you need to use a tool, format it like this:
<mcp:tool_call>
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "execute_tool",
  "params": {
    "name": "tool_name",
    "parameters": {
      "param1": "value1"
    }
  }
}
</mcp:tool_call>

IMPORTANT: If you can't format exactly like above, you can use: get_weather(location="city_name") 

For example: To check the weather in Seattle, you could use:
get_weather(location="Seattle")

CRITICALLY IMPORTANT INSTRUCTIONS:
1. Make only ONE tool call per response
2. After making a tool call, STOP your response and wait for the result
3. DO NOT make additional tool calls while waiting for results
4. DO NOT repeat or duplicate tool calls
5. After receiving tool results, respond normally to the user without making new tool calls
6. Wait for the user to ask another question before using tools again

User message: ${userMessage.content}`,
          createdAt: new Date().toISOString()
        };
        
        response = await callGeminiAPI([userInstruction], selectedModel);
      } else if (selectedModel.includes('claude')) {
        response = await callAnthropicAPI([...messages, systemMessage, userMessage], selectedModel);
      } else {
        // Create a simple instruction for other models as fallback
        const fallbackInstruction: ChatMessage = {
          id: `fallback-${Date.now()}`,
          role: 'user' as const,
          content: `${systemMessage.content}\n\nUser: ${userMessage.content}`,
          createdAt: new Date().toISOString()
        };
        response = await callGeminiAPI([fallbackInstruction], selectedModel);
      }
      
      if (response.success && response.message) {
        const assistantMessage = response.message as ChatMessage;
        
        // Save the original message content before processing tool calls
        const originalContent = assistantMessage.content || '';
        
        // Handle empty responses from Gemini 2.5 Pro
        if (!originalContent.trim()) {
          console.log("Empty response received from Gemini, attempting to recover");
          // Add a placeholder message
          setMessages(prev => [...prev, {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: "I'll help you with that. Let me check for you...",
            createdAt: new Date().toISOString()
          }]);

          // For weather queries, try direct detection
          if (userMessage.content.toLowerCase().includes('weather')) {
            // Extract location from the user message
            const locationPatterns = [
              /weather\s+(?:in|for|at)\s+([a-zA-Z0-9\s,\-\.]+)/i,
              /(?:in|for|at)\s+([a-zA-Z0-9\s,\-\.]+)(?:\s+weather)/i,
              /what(?:'s|\s+is)\s+(?:the\s+)?weather\s+(?:in|for|at)\s+([a-zA-Z0-9\s,\-\.]+)/i,
              /([a-zA-Z0-9\s,\-\.]+)\s+weather/i
            ];
            
            let location = "";
            for (const pattern of locationPatterns) {
              const match = userMessage.content.match(pattern);
              if (match && match[1]) {
                location = match[1].trim();
                break;
              }
            }
            
            if (location) {
              const weatherServer = installedServers.find(server => 
                server.tools.some(tool => tool.name.includes('weather') || tool.name.includes('get_weather'))
              );
              
              if (weatherServer) {
                const weatherTool = weatherServer.tools.find(tool => 
                  tool.name.includes('weather') || tool.name.includes('get_weather')
                );
                
                if (weatherTool) {
                  const toolCall: ToolCall = {
                    id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    tool: weatherTool.name,
                    args: { location },
                    status: 'pending'
                  };
                  
                  try {
                    // Process the weather tool call directly
                    await processToolCall(
                      toolCall, 
                      installedServers,
                      setActiveToolCalls,
                      (message) => setMessages(prev => [...prev, message]),
                      async (toolCall, result) => {
                        await generateFollowUpResponse(toolCall, result);
                      }
                    );
                  } catch (error) {
                    console.error("Error processing emergency tool call:", error);
                  }
                }
              }
            }
          }
          return; // Skip further processing
        }
        
        // Check for tool calls in the assistant message
        const toolCalls = detectToolCalls(originalContent, installedServers);
        
        if (toolCalls.length > 0) {
          // First, add the assistant message with its original content and tool calls
          // This ensures the message is always displayed even if tool processing fails
          const enhancedMessage: ChatMessage = {
            ...assistantMessage,
            content: originalContent, // Ensure original content is preserved
            toolCalls: toolCalls
          };
          
          setActiveToolCalls(toolCalls);
          setMessages(prev => [...prev, enhancedMessage]);
          
          // Process only the first tool call to prevent chaining
          if (toolCalls.length > 0) {
            try {
              // Use our enhanced tool processing utility
              await processToolCall(
                toolCalls[0], 
                installedServers,
                setActiveToolCalls,
                (message) => setMessages(prev => [...prev, message]),
                async (toolCall, result) => {
                  await generateFollowUpResponse(toolCall, result);
                }
              );
            } catch (error) {
              console.error("Error processing tool call:", error);
              // If tool processing fails, at least the original message is already displayed
              // Add an error message
              setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'system',
                content: `Error processing tool: ${error instanceof Error ? error.message : String(error)}`,
                createdAt: new Date().toISOString()
              }]);
            }
          }
        } else {
          // Add the assistant message without tool calls
          setMessages(prev => [...prev, assistantMessage]);
        }
      } else if (response.error) {
        // Handle API error
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `Error: ${response.error}`,
          createdAt: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Add error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
      setActiveToolCalls([]);
    }
  };

  const generateFollowUpResponse = async (toolCall: ToolCall, result: any) => {
    console.log(`Generating follow-up response for tool call ${toolCall.id}`);
    
    try {
      // Create a follow-up prompt that explicitly prevents additional tool calls
      const followUpPrompt = createFollowUpPrompt(toolCall, result, selectedModel);
      
      console.log('Calling LLM API to generate follow-up response');
      
      // Create messages for the follow-up request
      let followUpMessages: ChatMessage[];
      
      if (selectedModel.startsWith('gemini')) {
        // For Gemini, we just use the followUpPrompt as a single message
        followUpMessages = [followUpPrompt];
      } else {
        // For other models, include some context
        followUpMessages = [
          {
            id: `context-${Date.now()}`,
            role: 'user',
            content: 'I need information from a tool.',
            createdAt: new Date().toISOString()
          },
          followUpPrompt
        ];
      }
      
      // Call the LLM API to generate a follow-up response
      let response;
      if (selectedModel.startsWith('gemini')) {
        response = await callGeminiAPI(followUpMessages, selectedModel);
      } else if (selectedModel.includes('claude')) {
        response = await callAnthropicAPI(followUpMessages, selectedModel);
      } else {
        // Fallback to Gemini
        response = await callGeminiAPI(followUpMessages, selectedModel);
      }
      
      console.log('LLM follow-up response received:', response);
      
      if (response.success && response.message) {
        const followUpMessage = response.message as ChatMessage;
        
        // Check if the follow-up message contains tool calls
        const toolCalls = detectToolCalls(followUpMessage.content, installedServers);
        
        if (toolCalls.length > 0) {
          // Add tool calls to the follow-up message but do not process them
          const enhancedFollowUpMessage = {
            ...followUpMessage,
            toolCalls
          };
          
          // Add the message but do not process any more tool calls
          setMessages(prev => [...prev, enhancedFollowUpMessage]);
        } else {
          // Add the follow-up message without tool calls
          console.log('Adding follow-up message to conversation');
          setMessages(prev => [...prev, followUpMessage]);
        }
      } else if (response.error) {
        console.error('Error in LLM response:', response.error);
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("Error generating follow-up response:", error);
      // Add a conversational fallback message if the LLM call fails
      const fallbackFollowUp: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `I've found the information you requested. Let me know if you need any other details.`,
        createdAt: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, fallbackFollowUp]);
    }
  };

  const handleInstallServer = (server: MCPServer) => {
    // Add the server to installed servers
    setInstalledServers(prev => {
      // Check if already installed
      if (prev.some(s => s.id === server.id)) {
        return prev;
      }
      
      const newInstalledServers = [...prev, server];
      // Save to local storage
      localStorage.setItem('installedServers', JSON.stringify(newInstalledServers));
      
      return newInstalledServers;
    });
    
    setShowServerDialog(false);
  };

  const handleRemoveServer = (serverId: string) => {
    setInstalledServers(prev => {
      const newInstalledServers = prev.filter(server => server.id !== serverId);
      // Save to local storage
      localStorage.setItem('installedServers', JSON.stringify(newInstalledServers));
      
      return newInstalledServers;
    });
  };
  
  const handleConfigFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      const errorMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        content: "File is too large. Maximum size is 10MB.",
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    
    setConfigProcessing(true);
    
    try {
      // Read the file
      const fileContent = await file.text();
      
      // Parse the JSON content
      const serverConfig = JSON.parse(fileContent);
      
      // Validate that the JSON has the required MCP server structure
      if (!validateMCPServerConfig(serverConfig)) {
        const errorMessage: ChatMessage = {
          id: `system-${Date.now()}`,
          content: "Invalid MCP server configuration. Please check the file format.",
          role: "system",
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
        setConfigProcessing(false);
        return;
      }
      
      // Create a proper MCPServer object
      const now = new Date().toISOString();
      const server: MCPServer = {
        id: serverConfig.id || `imported-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: serverConfig.name || "Imported Server",
        description: serverConfig.description || "Imported from configuration file",
        ownerId: userSession?.user?.id || 'anonymous',
        createdAt: serverConfig.created_at || now,
        updatedAt: serverConfig.updated_at || now,
        isPublic: serverConfig.is_public || false,
        expiresAt: serverConfig.expires_at,
        tools: serverConfig.tools?.map((tool: any) => ({
          id: tool.id || `tool-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: tool.name,
          description: tool.description || `Tool for ${tool.name}`,
          parameters: tool.parameters || [],
          serverId: serverConfig.id,
          createdAt: tool.created_at || now,
          updatedAt: tool.updated_at || now
        })) || [],
        resources: serverConfig.resources || [],
        prompts: serverConfig.prompts || [],
        schemaVersion: serverConfig.schema_version || "2025-03-26",
        transportTypes: serverConfig.transport_types || ["sse", "stdio"],
        capabilities: serverConfig.capabilities || {
          tools: (serverConfig.tools?.length || 0) > 0,
          resources: (serverConfig.resources?.length || 0) > 0,
          prompts: (serverConfig.prompts?.length || 0) > 0,
          sampling: false
        }
      };
      
      // Add the server to installed servers
      handleInstallServer(server);
      
      // Reset the file input
      event.target.value = "";
      
      // Add success message
      const successMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        content: `Successfully imported MCP server "${server.name}" with ${server.tools.length} tools.`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, successMessage]);
      
    } catch (error) {
      console.error("Error processing config file:", error);
      const errorMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        content: `Error processing config file: ${error instanceof Error ? error.message : String(error)}`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setConfigProcessing(false);
    }
  };
  
  const validateMCPServerConfig = (config: any): boolean => {
    // Basic validation to ensure it's a valid MCP server configuration
    if (!config) return false;
    
    // Check for essential properties
    if (!config.name) return false;
    
    // Check for tools array
    if (config.tools && !Array.isArray(config.tools)) return false;
    
    // Validate tools if they exist
    if (config.tools && Array.isArray(config.tools)) {
      for (const tool of config.tools) {
        if (!tool.name) return false;
      }
    }
    
    return true;
  };
  
  const handleServerUrlAdd = async () => {
    if (!serverUrl) return;
    
    try {
      // Validate URL format
      let url = serverUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      
      const validUrl = new URL(url);
      
      // Create a server object from the URL
      const serverId = validUrl.pathname.split('/').pop() || `url-${Date.now()}`;
      const server: MCPServer = {
        id: serverId,
        name: `Server at ${validUrl.hostname}`,
        description: `MCP Server at ${url}`,
        ownerId: userSession?.user?.id || 'anonymous',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic: false,
        tools: [],
        resources: [],
        prompts: [],
        schemaVersion: "2025-03-26",
        transportTypes: ["sse", "stdio"],
        capabilities: {
          tools: true,
          resources: false,
          prompts: false,
          sampling: false
        }
      };
      
      // Add the server to installed servers
      handleInstallServer(server);
      
      // Reset the URL input
      setServerUrl("");
      
      // Add success message
      const successMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        content: `Successfully added MCP server at ${url}`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, successMessage]);
      
    } catch (error) {
      console.error("Error adding server URL:", error);
      const errorMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        content: "Invalid URL format. Please enter a valid URL.",
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>MCP Servers</CardTitle>
              <CardDescription>
                Connected servers extend AI capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {installedServers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No servers installed</p>
                ) : (
                  installedServers.map(server => (
                    <div key={server.id} className="flex items-center justify-between border rounded-lg p-2">
                      <div>
                        <div className="font-medium text-sm">{server.name}</div>
                        <div className="text-xs text-muted-foreground">{server.tools.length} tools</div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRemoveServer(server.id)}
                        className="h-6 w-6 p-0"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                        <span className="sr-only">Remove</span>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Dialog open={showServerDialog} onOpenChange={setShowServerDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    Add Server
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add MCP Server</DialogTitle>
                    <DialogDescription>
                      Add a server to your MCP Client
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Tabs defaultValue="marketplace" className="w-full">
                    <TabsList className="grid grid-cols-3 mb-4">
                      <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
                      <TabsTrigger value="config">Config File</TabsTrigger>
                      <TabsTrigger value="url">URL</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="marketplace" className="py-2">
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {availableServers.map(server => (
                          <div 
                            key={server.id} 
                            className="flex justify-between items-center border rounded-lg p-3 hover:bg-muted/50 cursor-pointer"
                            onClick={() => handleInstallServer(server)}
                          >
                            <div>
                              <div className="font-medium">{server.name}</div>
                              <div className="text-sm text-muted-foreground">{server.description}</div>
                            </div>
                            <Button size="sm">Install</Button>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="config" className="py-2">
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground mb-2">
                          Upload an MCP configuration file (mcp_config.json)
                        </div>
                        
                        <div className="flex items-center justify-center w-full">
                          <label htmlFor="mcp-config-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <svg className="w-8 h-8 mb-3 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <p className="mb-2 text-sm text-muted-foreground">Click to upload or drag and drop</p>
                              <p className="text-xs text-muted-foreground">JSON file (max 10MB)</p>
                            </div>
                            <input 
                              id="mcp-config-upload" 
                              type="file" 
                              accept=".json" 
                              className="hidden" 
                              onChange={handleConfigFileUpload}
                            />
                          </label>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="url" className="py-2">
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground mb-2">
                          Enter the URL of an MCP server to add
                        </div>
                        
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="https://example.com/api/mcp/server-id"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                          />
                          <Button 
                            onClick={handleServerUrlAdd} 
                            disabled={!serverUrl}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowServerDialog(false)}>Cancel</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
          
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Models</CardTitle>
              <CardDescription>
                Select an LLM to use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="gemini" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="gemini">Gemini</TabsTrigger>
                  <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
                </TabsList>
                <TabsContent value="gemini" className="space-y-2 mt-2">
                  <Button 
                    variant={selectedModel === "gemini-2.0-flash" ? "default" : "outline"} 
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("gemini-2.0-flash")}
                  >
                    <div className="text-left">
                      <div className="font-medium">Gemini 2.0 Flash</div>
                      <div className="text-xs text-muted-foreground">Google's fastest model</div>
                    </div>
                  </Button>
                  <Button 
                    variant={selectedModel === "gemini-2.5-pro-exp-03-25" ? "default" : "outline"} 
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("gemini-2.5-pro-exp-03-25")}
                  >
                    <div className="text-left">
                      <div className="font-medium">Gemini 2.5 Pro</div>
                      <div className="text-xs text-muted-foreground">Google's most capable model</div>
                    </div>
                  </Button>
                </TabsContent>
                <TabsContent value="anthropic" className="space-y-2 mt-2">
                  <Button 
                    variant={selectedModel === "claude-3-7-sonnet-20250219" ? "default" : "outline"} 
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("claude-3-7-sonnet-20250219")}
                  >
                    <div className="text-left">
                      <div className="font-medium">Claude 3.7 Sonnet</div>
                      <div className="text-xs text-muted-foreground">Best for tool usage</div>
                    </div>
                  </Button>
                  <Button 
                    variant={selectedModel === "claude-3-5-sonnet-20241022" ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("claude-3-5-sonnet-20241022")}
                  >
                    <div className="text-left">
                      <div className="font-medium">Claude 3.5 Sonnet</div>
                      <div className="text-xs text-muted-foreground">Most powerful Claude model</div>
                    </div>
                  </Button>
                  <Button 
                    variant={selectedModel === "claude-3-5-haiku-20241022" ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("claude-3-5-haiku-20241022")}
                  >
                    <div className="text-left">
                      <div className="font-medium">Claude 3.5 Haiku</div>
                      <div className="text-xs text-muted-foreground">Fastest Claude model</div>
                    </div>
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-3">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>MCP Client</CardTitle>
              <CardDescription>
                Interact with AI using MCP tools
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              <ChatContainer messages={messages} isLoading={isLoading} />
            </CardContent>
            <CardFooter>
              <div className="flex w-full items-center space-x-2">
                <Input
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={isLoading || !input.trim()}
                >
                  Send
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
