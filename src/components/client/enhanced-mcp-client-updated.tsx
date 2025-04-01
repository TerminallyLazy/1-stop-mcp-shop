"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { callGeminiAPI } from "@/lib/api/gemini";
import { callOpenRouterAPI } from "@/lib/api/openrouter";
import { ChatMessage, MCPServer, ToolCall } from "@/lib/types";
import { listMCPServers } from "@/lib/api/mcp";
import { getUserSession } from "@/lib/supabase";
import { ChatContainer } from "./chat-container";
import { processToolCall, createFollowUpPrompt } from "@/lib/utils/tool-handler";

export function EnhancedMCPClientUpdated() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [availableServers, setAvailableServers] = useState<MCPServer[]>([]);
  const [installedServers, setInstalledServers] = useState<MCPServer[]>([]);
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([]);
  const [userSession, setUserSession] = useState<{user: any, subscription?: string}|null>(null);

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
      // Check for tool call indicators in the message content
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
    
    // Handle special patterns (weather, calculator, etc.) as before
    // Simplified for brevity - we'll focus on the UI improvements
    
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
          content: `You are a helpful assistant that can have natural conversations with users. You can also use tools when appropriate, but you don't need to use tools for every response.

Available tools: ${installedServers.map(server => 
            server.tools.map(tool => `${tool.name} - ${tool.description}`).join(', ')
          ).join('. ')}

IMPORTANT: After using a tool once, just respond to the information without making additional tool calls. Wait for the user to ask another question before using tools again.

If I ask about weather, you can use the weather tool. Otherwise, just have a normal conversation.

User message: ${userMessage.content}`,
          createdAt: new Date().toISOString()
        };
        
        response = await callGeminiAPI([userInstruction], selectedModel);
      } else {
        response = await callOpenRouterAPI([...messages, systemMessage, userMessage], selectedModel);
      }
      
      if (response.success && response.message) {
        let assistantMessage = response.message as ChatMessage;
        
        // Save the original message content before processing tool calls
        const originalContent = assistantMessage.content;
        
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
      } else {
        response = await callOpenRouterAPI(followUpMessages, selectedModel);
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
                      Select a server to add to your MCP Client
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
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
                  </div>
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
                  <TabsTrigger value="openrouter">OpenRouter</TabsTrigger>
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
                <TabsContent value="openrouter" className="space-y-2 mt-2">
                  <Button 
                    variant={selectedModel === "openai/gpt-4o" ? "default" : "outline"} 
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("openai/gpt-4o")}
                  >
                    <div className="text-left">
                      <div className="font-medium">GPT-4o</div>
                      <div className="text-xs text-muted-foreground">Via OpenRouter</div>
                    </div>
                  </Button>
                  <Button 
                    variant={selectedModel === "anthropic/claude-3-7-sonnet-20250219" ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("anthropic/claude-3-7-sonnet-20250219")}
                  >
                    <div className="text-left">
                      <div className="font-medium">Claude 3 Opus</div>
                      <div className="text-xs text-muted-foreground">Via OpenRouter</div>
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
