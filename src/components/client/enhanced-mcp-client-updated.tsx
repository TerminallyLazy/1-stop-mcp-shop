"use client";

import { useState, useEffect, SetStateAction } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { callGeminiAPI } from "../../lib/api/gemini";
import { callAnthropicAPI } from "../../lib/api/anthropic";
import { ChatMessage, MCPServer, ToolCall, MCPTool } from "../../lib/types"; // Added MCPTool here
import { listMCPServers } from "../../lib/api/mcp";
import { getUserSession } from "../../lib/supabase";
import { ChatContainer } from "./chat-container";
import { processToolCall, createFollowUpPrompt } from "../../lib/utils/tool-handler";

// Storage key for localStorage
const MCP_SERVERS_STORAGE_KEY = 'mcp-installed-servers';

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Extended MCPServer interface to include config
interface ExtendedMCPServer extends MCPServer {
  config?: MCPServerConfig;
}

export function EnhancedMCPClientUpdated() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("claude-3-sonnet-20240229");
  const [availableServers, setAvailableServers] = useState<MCPServer[]>([]);
  const [installedServers, setInstalledServers] = useState<ExtendedMCPServer[]>([]);
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [showServerDetailsDialog, setShowServerDetailsDialog] = useState(false);
  const [serverDetails, setServerDetails] = useState<ExtendedMCPServer | null>(null);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([]);
  const [userSession, setUserSession] = useState<{user: any, subscription?: string}|null>(null);
  const [serverUrl, setServerUrl] = useState<string>("");
  const [configProcessing, setConfigProcessing] = useState<boolean>(false);
  const [discoveringServers, setDiscoveringServers] = useState<Record<string, boolean>>({}); // Track discovery status
  const [dockerDeployPath, setDockerDeployPath] = useState<string>("");
  const [dockerPort, setDockerPort] = useState<string>("3000");

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
        const storedServers = localStorage.getItem(MCP_SERVERS_STORAGE_KEY);
        if (storedServers) {
          try {
            const parsedServers = JSON.parse(storedServers);
            console.log("Loaded servers from localStorage:", parsedServers);
            
            // Normalize the servers to ensure all tools have parameters
            const normalizedServers = parsedServers.map((server: MCPServer) => ({
              ...server,
              tools: server.tools.map((tool: any) => ({
                ...tool,
                parameters: tool.parameters || []
              }))
            }));
            
            setInstalledServers(normalizedServers);
          } catch (error) {
            console.error("Error parsing stored servers:", error);
            // If there's an error, fallback to available servers
            if (servers.length > 0) {
              setInstalledServers([servers[0]]);
              localStorage.setItem(MCP_SERVERS_STORAGE_KEY, JSON.stringify([servers[0]]));
            }
          }
        } else if (servers.length > 0) {
          // If no stored servers, use the first one as default
          setInstalledServers([servers[0]]);
          localStorage.setItem(MCP_SERVERS_STORAGE_KEY, JSON.stringify([servers[0]]));
        }
      } catch (error) {
        console.error("Error initializing client:", error);
      }
    };

    fetchUserAndServers();
  }, []);


  // Effect to save installed servers to localStorage whenever it changes
  useEffect(() => {
    // Only save if we have servers to save
    if (installedServers.length > 0) {
      try {
        // Deduplicate servers by ID before saving
        const uniqueServers = [];
        const seenIds = new Set();
        
        for (const server of installedServers) {
          if (!seenIds.has(server.id)) {
            seenIds.add(server.id);
            uniqueServers.push(server);
          }
        }
        
        localStorage.setItem(MCP_SERVERS_STORAGE_KEY, JSON.stringify(uniqueServers));
        console.log("Saved installedServers to localStorage:", uniqueServers);
        
        // If we had duplicates, update the state
        if (uniqueServers.length !== installedServers.length) {
          console.log(`Removed ${installedServers.length - uniqueServers.length} duplicate servers`);
          setInstalledServers(uniqueServers);
        }
      } catch (error) {
        console.error("Error saving servers to localStorage:", error);
      }
    }
  }, [installedServers]);

  // Effect to trigger discovery for newly added servers that need it
  useEffect(() => {
    // Create a Set of servers that are currently being discovered
    const currentlyDiscovering = new Set(
      Object.entries(discoveringServers)
        .filter(([_, value]) => value)
        .map(([key, _]) => key)
    );
    
    // Track if we've initiated any discoveries in this effect cycle
    let discoveryInitiated = false;
    
    // Create a state update function to avoid race conditions
    const updatesToMake: Record<string, boolean> = {};
    
    installedServers.forEach(server => {
      // Skip if discovery is already in progress for this server
      if (currentlyDiscovering.has(server.id)) {
        return;
      }
      
      // Skip if this server already has tools
      if (server.tools.length > 0) {
        return;
      }
      
      // Check if server is eligible for discovery (has config or is URL-based)
      const needsDiscovery = ('config' in server && !!server.config) || server.id.startsWith('url-');
      
      // Skip if already being discovered (additional safety check)
      if (needsDiscovery && !discoveringServers[server.id]) {
        // Limit to one discovery per effect cycle to avoid overwhelming the UI
        if (!discoveryInitiated) {
          console.log(`Triggering discovery for server ID: ${server.id} from useEffect`);
          updatesToMake[server.id] = true;
          discoveryInitiated = true;
          
          // We'll start discovery outside the loop to avoid React state update issues
        }
      }
    });
    
    // Apply all state updates at once
    if (Object.keys(updatesToMake).length > 0) {
      // Update the discovering state first
      setDiscoveringServers(prev => ({
        ...prev,
        ...updatesToMake
      }));
      
      // Then trigger the actual discovery for the first server we marked
      const serverId = Object.keys(updatesToMake)[0];
      const serverToDiscover = installedServers.find(s => s.id === serverId);
      
      if (serverToDiscover) {
        // Use a small timeout to ensure state updates have processed
        setTimeout(() => {
          discoverServerTools(serverToDiscover);
        }, 100);
      }
    }
    
    // Dependency array includes installedServers to re-run when servers are added/removed
    // discoveringServers is included to avoid re-triggering while discovery is in progress
  }, [installedServers, discoveringServers]);

  // Handler to view server details
  const handleViewServerDetails = (server: ExtendedMCPServer) => {
    setServerDetails(server);
    setShowServerDetailsDialog(true);
  };

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
              server.tools.some((tool: { name: any; }) => tool.name === toolName)
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
          server.tools.some((tool: { name: string; }) => tool.name === toolName || 
                                   tool.name === `get_${toolName}`)
        );
        
        if (serverWithTool) {
          // Find the exact tool
          const exactToolName = serverWithTool.tools.find((t: { name: string; }) => 
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
          server.tools.some((tool: { name: string; }) => tool.name === toolName)
        );
        
        if (serverWithTool) {
          const tool = serverWithTool.tools.find((t: { name: string; }) => t.name === toolName);
          
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
        servers.some(server => server.tools.some((tool: { name: string | string[]; }) => 
          tool.name.includes('weather') || tool.name.includes('get_weather')
        ))) {
      
      const weatherServer = servers.find(server => 
        server.tools.some((tool: { name: string | string[]; }) => tool.name.includes('weather') || tool.name.includes('get_weather'))
      );
      
      if (weatherServer) {
        const weatherTool = weatherServer.tools.find((tool: { name: string | string[]; }) => 
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
Tools: ${server.tools.map((tool: { name: any; }) => tool.name).join(', ')}

${server.tools.map((tool: { name: any; description: any; parameters: any[]; }) => `Tool: ${tool.name}
Description: ${tool.description}
Parameters: ${tool.parameters.map((p: { name: any; type: any; required: any; }) => `${p.name} (${p.type}${p.required ? ', required' : ''})`).join(', ')}
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
            server.tools.map((tool: { name: any; description: any; }) => `${tool.name} - ${tool.description}`).join(', ')
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
        
        // Convert previous conversation history to a format suitable for Gemini
        const conversationHistory = messages.map(msg => {
          if (msg.role === 'user') {
            return { ...msg, content: `User: ${msg.content}`};
          } else if (msg.role === 'assistant') {
            return { ...msg, content: `Assistant: ${msg.content}`};
          } else if (msg.role === 'tool') {
            return { ...msg, content: `Tool Result: ${msg.content}`};
          }
          return msg;
        });
        
        // Include conversation history for context
        response = await callGeminiAPI([...conversationHistory, userInstruction], selectedModel);
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
                server.tools.some((tool: { name: string | string[]; }) => tool.name.includes('weather') || tool.name.includes('get_weather'))
              );
              
              if (weatherServer) {
                const weatherTool = weatherServer.tools.find((tool: { name: string | string[]; }) => 
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
                      (message: any) => setMessages(prev => [...prev, message]),
                      async (toolCall: any, result: any) => {
                        await generateFollowUpResponse(toolCall, result, selectedModel);
                      },
                      selectedModel
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
                (message: any) => setMessages(prev => [...prev, message]),
                async (toolCall: any, result: any) => {
                  await generateFollowUpResponse(toolCall, result, selectedModel);
                },
                selectedModel
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

  const generateFollowUpResponse = async (toolCall: ToolCall, result: any, selectedModel: string) => {
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
      // Check if already installed by ID or name
      const isAlreadyInstalled = prev.some(s => s.id === server.id || s.name === server.name);
      
      if (isAlreadyInstalled) {
        // Show a message to the user that the server is already installed
        const alreadyInstalledMessage: ChatMessage = {
          id: `system-already-installed-${server.id}-${Date.now()}`,
          content: `Server "${server.name}" is already installed.`,
          role: "system",
          createdAt: new Date().toISOString()
        };
        setMessages(prevMessages => [...prevMessages, alreadyInstalledMessage]);
        return prev;
      }
      
      // Make a copy with normalized tools (ensure parameters exist)
      const normalizedServer = {
        ...server,
        tools: server.tools.map(tool => ({
          ...tool,
          parameters: tool.parameters || []
        }))
      };
      
      // Create a unique array of servers to avoid duplicates
      const newInstalledServers = [...prev, normalizedServer];
      
      // Add a message about the server's tools
      const toolMessage: ChatMessage = {
        id: `system-added-${server.id}-${Date.now()}`,
        content: `Added server configuration for "${server.name}". ${server.tools.length > 0 ? 
          `Available tools: ${server.tools.map((t: any) => t.name).join(', ')}` : 
          "Attempting to discover tools..."}`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, toolMessage]);
      
      return newInstalledServers;
      // Note: The useEffect will handle saving to localStorage and deduplication
    });
    
    setShowServerDialog(false);
    // Discovery is triggered by the useEffect hook watching installedServers
  };

  // --- Updated Function: Discover Server Tools ---
  // Now accepts the full server object
  const discoverServerTools = async (serverToDiscover: ExtendedMCPServer) => {
     const serverId = serverToDiscover.id;
     console.log(`discoverServerTools called for server ID: ${serverId}`);
     setDiscoveringServers(prev => ({ ...prev, [serverId]: true }));

    // Add connecting message with a more unique ID
     const connectingMessage: ChatMessage = {
      id: `system-discovery-${serverId}-${Date.now()}`, // Added serverId
      content: `Attempting to connect and discover tools for server "${serverToDiscover.name}"...`,
      role: "system",
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, connectingMessage]);

    try {
      // --- Actual Discovery via Backend API ---
      let requestBody: any;
      let serverUrlForDiscovery: string | undefined;

      // Determine request type and data based on server info
      if ('config' in serverToDiscover && serverToDiscover.config) {
        requestBody = {
          type: 'config',
          config: serverToDiscover.config,
          serverId: serverId,
        };
      } else if (serverToDiscover.id.startsWith('url-')) {
         // Extract URL from description (adjust if stored differently)
         const urlMatch = serverToDiscover.description?.match(/MCP Server at (https?:\/\/[^\s]+)/);
         if (urlMatch && urlMatch[1]) {
            serverUrlForDiscovery = urlMatch[1];
            // Ensure the URL doesn't end with a trailing slash which can cause issues
            serverUrlForDiscovery = serverUrlForDiscovery.replace(/\/+$/, '');
            
            // For Docker servers, make sure we're using the server port not web UI port
            if (serverToDiscover.id.startsWith('url-docker-') && serverUrlForDiscovery.includes('localhost')) {
              // Add /mcp endpoint which is the standard for MCP servers
              if (!serverUrlForDiscovery.endsWith('/mcp')) {
                serverUrlForDiscovery = `${serverUrlForDiscovery}/mcp`;
              }
            }
            
            requestBody = {
              type: 'url',
              url: serverUrlForDiscovery,
              serverId: serverId,
            };
         } else {
            throw new Error(`Could not extract URL from server description: ${serverToDiscover.description}`);
         }
      } else {
         // Maybe it's a marketplace server that somehow lost its tools? Or an unknown type.
         console.warn(`Server ${serverId} does not have config and is not URL-based. Skipping discovery.`);
         // Optionally, set discovery as finished without error
         setDiscoveringServers(prev => ({ ...prev, [serverId]: false }));
         // Remove the "Attempting to connect..." message? Or add a "Skipping discovery..." message?
         // Let's remove the connecting message for now if we skip.
         setMessages(prev => prev.filter(msg => msg.id !== connectingMessage.id));
         return; // Exit discovery for this server
      }

      console.log(`Sending discovery request to /api/mcp/discover for server ${serverId}`);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Connection timed out after 10 seconds.")), 10000);
      });

      const fetchPromise = fetch('/api/mcp/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Use Promise.race to implement a timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

      // Check if we need to abort the request due to timeout
      if (!response.ok && response.status === 0) {
        throw new Error("Connection timeout or network error.");
      }

      const result = await response.json();

      if (!response.ok) {
        // Throw error using the message from the backend response if available
        throw new Error(result.error || `API request failed with status ${response.status}`);
      }

      // Ensure the response has the expected 'tools' array
      if (!result || !Array.isArray(result.tools)) {
        throw new Error('Invalid response format from discovery API.');
      }

      const discoveredTools: MCPTool[] = result.tools;
      console.log(`Received ${discoveredTools.length} tools for server ${serverId} from API.`);
      // --- End Actual Discovery ---

      // Update the server in the state with discovered tools
      setInstalledServers(prev => {
        // Map over previous state to update the specific server
        const updatedServers = prev.map(s =>
          s.id === serverId ? {
            ...s,
            // Ensure each tool has a parameters array
            tools: discoveredTools.map(tool => ({
              ...tool,
              parameters: tool.parameters || []
            }))
          } : s
        );
        // Return the new state. localStorage saving is handled by the useEffect hook.
        return updatedServers;
      });

      // Add success message with a more unique ID
      const toolCount = discoveredTools.length;
      const discoverySuccessMessage: ChatMessage = {
        id: `system-discovered-${serverId}-${Date.now()}`, // Added serverId
        content: `Successfully connected to "${serverToDiscover.name}". Discovered ${toolCount} ${toolCount === 1 ? 'tool' : 'tools'}: ${discoveredTools.map(t => t.name).join(', ')}.`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, discoverySuccessMessage]);

    } catch (error) {
      console.error(`Error discovering tools for server ${serverId}:`, error);
      
      // Create a user-friendly error message
      let errorMessage = error instanceof Error ? error.message : String(error);
      let userFriendlyMsg = errorMessage;
      
      // Detect HTML response error
      if (errorMessage.includes('regular web server') || 
          errorMessage.includes('HTML instead of') || 
          errorMessage.includes('<!DOCTYPE') ||
          errorMessage.includes('Unexpected token')) {
        userFriendlyMsg = `The Docker container at this URL is running a regular web server (not an MCP server). It's serving HTML pages instead of responding to MCP protocol requests. Check the port and make sure your container implements the Model Context Protocol.`;
      }
      
      // Add error message with a more unique ID
      const discoveryErrorMessage: ChatMessage = {
        id: `system-discovery-error-${serverId}-${Date.now()}`, // Added serverId
        content: `Failed to connect or discover tools for server "${serverToDiscover.name}": ${userFriendlyMsg}`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, discoveryErrorMessage]);
      
      // Create a sample MCP server message
      if (serverToDiscover.id.startsWith('url-docker-')) {
        const sampleMessage: ChatMessage = {
          id: `system-sample-${serverId}-${Date.now()}`,
          content: `This issue is because Docker deployments created through this interface are basic static web servers, not MCP-compatible servers. Currently, you'll need to deploy a proper MCP server separately.`,
          role: "system",
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, sampleMessage]);
      }
    } finally {
      // Always mark discovery as complete to avoid any stuck states
      setDiscoveringServers(prev => ({ ...prev, [serverId]: false }));
    }
  };
  // --- End New Function ---


  const handleRemoveServer = (serverId: string) => {
    setInstalledServers(prev => {
      const newInstalledServers = prev.filter(server => server.id !== serverId);
      // Save to local storage
      localStorage.setItem(MCP_SERVERS_STORAGE_KEY, JSON.stringify(newInstalledServers));
      
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
      
      // Track servers being processed from this config file
      const configServerNames = new Set<string>(Object.keys(serverConfig.mcpServers));
      
      // Find existing servers that came from config files
      setInstalledServers(prev => {
        // Get all servers not coming from this config file
        const otherServers = prev.filter(s => {
          // Keep servers that aren't imported or have different names than what's in this config
          return !s.id.startsWith('imported-') || !configServerNames.has(s.name);
        });
        
        // Create a map of existing servers by name for easy lookup (including non-imported servers)
        const existingServersByName = new Map<string, ExtendedMCPServer>();
        prev.forEach(server => {
          if (server.name) {
            existingServersByName.set(server.name, server);
          }
        });
        
        // Process each server in the new config
        const updatedAndNewServers: ExtendedMCPServer[] = [];
        
        Object.entries<MCPServerConfig>(serverConfig.mcpServers).forEach(([serverName, config]) => {
          const now = new Date().toISOString();
          // Ensure args is always an array
          const args = config.args && Array.isArray(config.args) ? config.args : [];
          
          // Check if this server already exists by name
          const existingServer = existingServersByName.get(serverName);
          
          if (existingServer) {
            // Server exists - update config but keep existing tools if any
            updatedAndNewServers.push({
              ...existingServer,
              description: `MCP Server using ${config.command}`,
              updatedAt: now,
              config: {
                command: config.command,
                args: config.args,
                env: config.env
              }
            });
            
            console.log(`Updated existing server: ${serverName}`);
          } else {
            // Create a new server
            updatedAndNewServers.push({
              id: `imported-${serverName}-${Date.now()}`,
              name: serverName,
              description: `MCP Server using ${config.command}`,
              ownerId: userSession?.user?.id || 'anonymous',
              createdAt: now,
              updatedAt: now,
              isPublic: false,
              tools: [], // Initialize with empty tools; discovery will populate this
              resources: [],
              prompts: [],
              schemaVersion: "2025-03-26",
              transportTypes: ["sse", "stdio"],
              capabilities: {
                tools: true,
                resources: false,
                prompts: false,
                sampling: false
              },
              config: {
                command: config.command,
                args: config.args,
                env: config.env
              }
            });
            
            console.log(`Added new server: ${serverName}`);
          }
        });
        
        // Create a final deduplicated list
        const allServers = [...otherServers, ...updatedAndNewServers];
        
        // Ensure no duplicates by ID
        const uniqueServers = [];
        const seenIds = new Set();
        
        for (const server of allServers) {
          if (!seenIds.has(server.id)) {
            seenIds.add(server.id);
            uniqueServers.push(server);
          }
        }
        
        console.log(`Config processing complete: ${uniqueServers.length} servers (${updatedAndNewServers.length} from config)`);
        return uniqueServers;
      });
      
      // Reset the file input
      event.target.value = "";
      
      // Add a message confirming the config processing
      const importSuccessMessage: ChatMessage = {
        id: `system-import-${Date.now()}`,
        content: `Successfully processed configuration file. MCP servers have been updated. Tool discovery will begin for new servers.`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, importSuccessMessage]);
      
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
    if (!config || typeof config !== 'object') return false;
    
    // Check for mcpServers object
    if (!config.mcpServers || typeof config.mcpServers !== 'object') return false;
    
    // Validate each server configuration
    for (const [serverName, serverConfig] of Object.entries<MCPServerConfig>(config.mcpServers)) {
      if (typeof serverConfig !== 'object') return false;
      if (!serverConfig.command || typeof serverConfig.command !== 'string') return false;
      if (!serverConfig.args || !Array.isArray(serverConfig.args)) return false;
      if (serverConfig.env && typeof serverConfig.env !== 'object') return false;
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
      
      // Check if we already have this URL in installedServers
      // Also normalize the URL for comparison
      const normalizedUrl = url.trim().toLowerCase().replace(/\/+$/, ''); // Remove trailing slashes
      
      // More thorough check for duplicates by comparing normalized URLs
      const urlExists = installedServers.some(server => {
        if (!server.description) return false;
        
        // Extract URL from description if it exists
        const urlMatch = server.description.match(/MCP Server at (https?:\/\/[^\s]+)/i);
        if (!urlMatch || !urlMatch[1]) return false;
        
        // Normalize the stored URL for comparison
        const storedUrl = urlMatch[1].trim().toLowerCase().replace(/\/+$/, '');
        
        // Compare normalized URLs
        return storedUrl === normalizedUrl ||
               storedUrl === `http://${normalizedUrl}` ||
               storedUrl === `https://${normalizedUrl}` ||
               `http://${storedUrl}` === normalizedUrl ||
               `https://${storedUrl}` === normalizedUrl;
      });
      
      if (urlExists) {
        const duplicateMessage: ChatMessage = {
          id: `system-duplicate-${Date.now()}`,
          content: `A server with URL ${url} is already installed.`,
          role: "system",
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, duplicateMessage]);
        setServerUrl("");
        return;
      }
      
      // Show connecting message
      const connectingMessage: ChatMessage = {
        id: `system-connecting-${Date.now()}`,
        content: `Connecting to MCP server at ${url}...`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, connectingMessage]);
      
      // Attempt to fetch server metadata (this would be a real API call in production)
      try {
        // In a real implementation, we would fetch server metadata from the URL
        // For now, we'll simulate a successful connection with a timeout
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create a server object from the URL
        // Use a more predictable ID based on the hostname
        const serverId = `url-${validUrl.hostname}-${Date.now()}`;
        const server: ExtendedMCPServer = {
          id: serverId,
          name: `Server at ${validUrl.hostname}`,
          description: `MCP Server at ${url}`,
          ownerId: userSession?.user?.id || 'anonymous',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublic: false, // Assuming URL-added servers are private by default
          tools: [], // Initialize with empty tools; discovery will populate this
          resources: [], // Assuming resources are not handled by URL import for now
          prompts: [],   // Assuming prompts are not handled by URL import for now
          schemaVersion: "2025-03-26",
          transportTypes: ["sse", "stdio"],
          capabilities: {
            tools: true,
            resources: false,
            prompts: false,
            sampling: false
          }
        };
        
        // Add the server configuration to state. Discovery will be triggered by useEffect.
        setInstalledServers(prev => [...prev, server]);

        // Reset the URL input
        setServerUrl("");

        // Add initial success message. Discovery messages will follow.
        const addUrlSuccessMessage: ChatMessage = {
          id: `system-url-add-${server.id}-${Date.now()}`, // More unique ID
          content: `Added server configuration from ${url}. Tool discovery will begin shortly.`,
          role: "system",
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, addUrlSuccessMessage]);

      } catch (connectionError) { // This catch block handles errors during the *initial* setup (e.g., metadata fetch simulation)
        console.error("Error during initial URL processing (not connection/discovery):", connectionError);
        const processingErrorMessage: ChatMessage = { // Corrected variable name
          id: `system-url-error-${Date.now()}`, // Use a distinct ID
          content: `Error processing server URL ${url}. Error: ${connectionError instanceof Error ? connectionError.message : String(connectionError)}`,
          role: "system",
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, processingErrorMessage]); // Use the correct variable
      }
    } catch (error) { // This outer catch handles URL validation errors
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

  // Add a new handler for Docker servers with improved functionality
  const handleDockerServerAdd = async () => {
    if (!dockerDeployPath.trim()) return;
    
    try {
      // Extract folder name to use as server name
      const pathParts = dockerDeployPath.trim().split('/');
      const folderName = pathParts[pathParts.length - 1];
      
      // Use the user-provided port
      const port = dockerPort || "3000";
      
      // Create a server entry for the Docker deployment with the specified port
      const serverId = `url-docker-${Date.now()}`;
      const server: ExtendedMCPServer = {
        id: serverId,
        name: `Docker: ${folderName}`,
        description: `MCP Server at http://localhost:${port}/mcp`,
        ownerId: userSession?.user?.id || 'anonymous',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic: false,
        tools: [],
        resources: [],
        prompts: [],
        schemaVersion: "2025-03-26",
        transportTypes: ["sse", "http"],
        capabilities: {
          tools: true,
          resources: false,
          prompts: false,
          sampling: false
        }
      };
      
      // Add the server to installed servers
      setInstalledServers(prev => [...prev, server]);
      
      // Clear the input fields
      setDockerDeployPath("");
      setDockerPort("3000");
      
      // Close the dialog
      setShowServerDialog(false);
      
      // Add a message about the added server
      const dockerAddMessage: ChatMessage = {
        id: `system-docker-${Date.now()}`,
        content: `Added Docker server from ${dockerDeployPath} with port ${port}. Starting connection...`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, dockerAddMessage]);
      
      // Add info message about MCP server requirements
      const infoMessage: ChatMessage = {
        id: `system-docker-info-${Date.now()}`,
        content: `Note: Make sure your Docker container runs an actual MCP-compatible server that responds to JSON-RPC requests. A static web server like Nginx alone won't work.`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, infoMessage]);
      
      // Add a message with instructions on how to handle error or remove server
      const helpMessage: ChatMessage = {
        id: `system-docker-remove-help-${Date.now()}`,
        content: `If you encounter "HTML instead of JSON" errors, it means your Docker container is not an MCP server. You can remove the server by clicking on it in the sidebar and then "Remove".`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, helpMessage]);
      
      // Try to discover tools for this server - discovery will be triggered by the useEffect
      // Do NOT manually trigger discovery here to avoid infinite loops
      setDiscoveringServers(prev => ({ ...prev, [server.id]: true }));
      
    } catch (error) {
      console.error("Error adding Docker server:", error);
      const errorMessage: ChatMessage = {
        id: `system-docker-error-${Date.now()}`,
        content: `Error adding Docker server: ${error instanceof Error ? error.message : String(error)}`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Add a helpful message for manual URL addition
      const helpMessage: ChatMessage = {
        id: `system-docker-help-${Date.now()}`,
        content: `You can add your Docker server manually using the URL option with http://localhost:PORT/mcp. Your Docker container must implement the Model Context Protocol and respond to JSON-RPC requests.`,
        role: "system",
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, helpMessage]);
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
                  <div className="text-center text-muted-foreground py-4">
                    No servers installed
                  </div>
                ) : (
                  installedServers.map((server) => (
                    <Button
                      key={server.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleViewServerDetails(server)}
                    >
                      <div className="text-left">
                        <div className="font-medium">{server.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {server.tools.length} tools
                        </div>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => setShowServerDialog(true)}>
                Add Server
              </Button>
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
              <div className="space-y-2">
                <Tabs defaultValue="anthropic">
                  <TabsList className="w-full">
                    <TabsTrigger value="gemini" className="flex-1">Gemini</TabsTrigger>
                    <TabsTrigger value="anthropic" className="flex-1">Anthropic</TabsTrigger>
                  </TabsList>
                  <TabsContent value="gemini" className="mt-2 space-y-2">
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
                  <TabsContent value="anthropic" className="mt-2 space-y-2">
                    <Button 
                      variant={selectedModel === "claude-3-7-sonnet-20250219" ? "default" : "outline"} 
                      className="w-full justify-start"
                      onClick={() => setSelectedModel("claude-3-7-sonnet-20250219")}
                    >
                      <div className="text-left">
                        <div className="font-medium">Claude 3.7 Sonnet</div>
                        <div className="text-xs text-muted-foreground">Smartest model</div>
                      </div>
                    </Button>
                    <Button 
                      variant={selectedModel === "claude-3-5-sonnet-20241022" ? "default" : "outline"} 
                      className="w-full justify-start"
                      onClick={() => setSelectedModel("claude-3-5-sonnet-20241022")}
                    >
                      <div className="text-left">
                        <div className="font-medium">Claude 3.5 Sonnet</div>
                        <div className="text-xs text-muted-foreground">High capability model</div>
                      </div>
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
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
            <CardContent className="flex-grow overflow-auto">
              <ChatContainer 
                messages={messages} 
                isLoading={isLoading} 
                activeToolCalls={activeToolCalls}
              />
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
                <Button onClick={handleSendMessage} disabled={isLoading || !input.trim()}>
                  Send
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Server Details Dialog - NEW */}
      <Dialog open={showServerDetailsDialog} onOpenChange={setShowServerDetailsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{serverDetails?.name}</DialogTitle>
            <DialogDescription>
              {serverDetails?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <h3 className="text-sm font-medium mb-2">Available Tools</h3>
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
              {serverDetails?.tools.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  {discoveringServers[serverDetails?.id || ""] ? (
                    "Discovering tools..."
                  ) : (
                    <div className="space-y-2">
                      <p>No tools available</p>
                      {serverDetails?.id.startsWith('url-docker-') && (
                        <div className="p-3 border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900 rounded-md text-xs mt-2">
                          <p className="font-medium mb-1">Possible Issue:</p>
                          <p>Your Docker container may not be an MCP-compatible server. It might be a static web server that doesn't respond to JSON-RPC requests.</p>
                          <p className="mt-1">Try deploying a proper MCP server with this container instead.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                serverDetails?.tools.map(tool => (
                  <div key={tool.id} className="border rounded-md p-3">
                    <h4 className="font-medium">{tool.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
                    
                    {tool.parameters?.length > 0 && (
                      <div className="mt-2">
                        <h5 className="text-xs font-medium mb-1">Parameters:</h5>
                        <div className="space-y-1">
                          {tool.parameters?.map((param, index) => (
                            <div key={`param-${tool.id || 'unknown'}-${index}`} className="text-xs">
                              <span className="font-medium">{param.name}</span>
                              <span className="text-muted-foreground"> ({param.type})</span>
                              {param.required && <span className="text-red-500">*</span>}
                              <p className="text-muted-foreground">{param.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {serverDetails?.connectionDetails && (
              <div className="mt-4 border rounded-md p-3">
                <h4 className="text-sm font-medium mb-1">Connection Details</h4>
                <p className="text-xs text-muted-foreground">
                  Connected via: {serverDetails.connectionDetails.method}
                  {serverDetails.connectionDetails.method === 'url' && 
                   serverDetails.connectionDetails.url && 
                   ` (${serverDetails.connectionDetails.url})`}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => handleRemoveServer(serverDetails?.id || "")}
              className="mr-auto"
            >
              Remove
            </Button>
            <Button onClick={() => setShowServerDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Server Dialog */}
      <Dialog open={showServerDialog} onOpenChange={setShowServerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add MCP Server</DialogTitle>
            <DialogDescription>
              Add a server to enhance your AI capabilities
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Tabs defaultValue="marketplace">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
                <TabsTrigger value="url">URL</TabsTrigger>
                <TabsTrigger value="docker">Docker</TabsTrigger>
                <TabsTrigger value="config">Config File</TabsTrigger>
              </TabsList>
              
              <TabsContent value="marketplace" className="space-y-4 mt-4">
                <div className="space-y-2">
                  {availableServers.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      No marketplace servers available
                    </div>
                  ) : (
                    availableServers.map((server) => (
                      <Button
                        key={server.id}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleInstallServer(server)}
                      >
                        <div className="text-left">
                          <div className="font-medium">{server.name}</div>
                          <div className="text-xs text-muted-foreground">{server.description}</div>
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="url" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Server URL</label>
                    <Input
                      placeholder="https://example.com/mcp"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleServerUrlAdd}
                    disabled={!serverUrl.trim()}
                    className="w-full"
                  >
                    Add Server
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="docker" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="p-3 border rounded-md bg-gray-50 dark:bg-gray-900 mb-4">
                    <p className="text-sm mb-2 font-medium">MCP Server Requirements:</p>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                      <li>Your Docker container must implement the MCP protocol</li>
                      <li>It should respond to JSON-RPC requests at the /mcp endpoint</li>
                      <li>Static web servers like Nginx alone won't work</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Docker Deployment Path</label>
                    <Input
                      placeholder="/home/lazy/Projects/1-stop-mcp-shop/docker-deployments/my-server-123456789"
                      value={dockerDeployPath}
                      onChange={(e) => setDockerDeployPath(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the full path to your Docker deployment directory
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Port</label>
                    <Input
                      placeholder="3000"
                      value={dockerPort}
                      onChange={(e) => setDockerPort(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the port your Docker MCP server is running on (check docker-compose.yml for the port mapping)
                    </p>
                  </div>
                  <Button 
                    onClick={handleDockerServerAdd}
                    disabled={!dockerDeployPath.trim()}
                    className="w-full"
                  >
                    Add Docker Server
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="config" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Configuration File</label>
                    <div className="flex items-center justify-center border border-dashed rounded-md p-4">
                      <label className="cursor-pointer">
                        <Input
                          type="file"
                          className="hidden"
                          accept=".json"
                          onChange={handleConfigFileUpload}
                          disabled={configProcessing}
                        />
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">
                            Click to upload a JSON configuration file
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowServerDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
