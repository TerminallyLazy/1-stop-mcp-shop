"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { callGeminiAPI } from "@/lib/api/gemini";
import { callOpenRouterAPI } from "@/lib/api/openrouter";
import { callMCPTool } from "@/lib/api/mcp";
import { ChatMessage, MCPServer, MCPTool, ToolCall } from "@/lib/types";
import { listMCPServers } from "@/lib/api/mcp";

export function EnhancedMCPClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [availableServers, setAvailableServers] = useState<MCPServer[]>([]);
  const [installedServers, setInstalledServers] = useState<MCPServer[]>([]);
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch available servers
  useEffect(() => {
    const fetchServers = async () => {
      try {
        const servers = await listMCPServers();
        setAvailableServers(servers);
        // In a real app, we would fetch the user's installed servers from a database
        // For now, we'll just use the first server as an example
        if (servers.length > 0) {
          setInstalledServers([servers[0]]);
        }
      } catch (error) {
        console.error("Error fetching servers:", error);
      }
    };

    fetchServers();
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      // Call the appropriate LLM API based on the selected model
      let response;
      if (selectedModel.startsWith('gemini')) {
        response = await callGeminiAPI([...messages, userMessage], selectedModel);
      } else {
        response = await callOpenRouterAPI([...messages, userMessage], selectedModel);
      }
      
      if (response.success && response.message) {
        const assistantMessage = response.message as ChatMessage;
        
        // Simulate tool calls detection (in a real app, this would be part of the LLM response)
        const toolCalls = detectToolCalls(assistantMessage.content, installedServers);
        
        if (toolCalls.length > 0) {
          // Add tool calls to the assistant message
          assistantMessage.toolCalls = toolCalls;
          setActiveToolCalls(toolCalls);
          
          // Add the assistant message with tool calls
          setMessages(prev => [...prev, assistantMessage]);
          
          // Process tool calls automatically
          for (const toolCall of toolCalls) {
            await processToolCall(toolCall, assistantMessage.id);
          }
        } else {
          // Add the assistant message without tool calls
          setMessages(prev => [...prev, assistantMessage]);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Add error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'An error occurred while processing your message.',
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
      setActiveToolCalls([]);
    }
  };

  const detectToolCalls = (content: string, servers: MCPServer[]): ToolCall[] => {
    // This is a simplified simulation of tool call detection
    // In a real app, the LLM would return structured tool calls
    
    const toolCalls: ToolCall[] = [];
    
    // Check for weather-related queries
    if (content.toLowerCase().includes('weather') && servers.some(server => 
      server.tools.some(tool => tool.name.includes('weather') || tool.name.includes('get_weather'))
    )) {
      const weatherServer = servers.find(server => 
        server.tools.some(tool => tool.name.includes('weather') || tool.name.includes('get_weather'))
      );
      
      if (weatherServer) {
        const weatherTool = weatherServer.tools.find(tool => 
          tool.name.includes('weather') || tool.name.includes('get_weather')
        );
        
        if (weatherTool) {
          // Extract location from content (simplified)
          let location = "New York";
          const locationMatch = content.match(/weather\s+in\s+([a-zA-Z\s]+)/i);
          if (locationMatch && locationMatch[1]) {
            location = locationMatch[1].trim();
          }
          
          toolCalls.push({
            id: `tool-${Date.now()}`,
            tool: weatherTool.name,
            args: { location },
            status: 'pending'
          });
        }
      }
    }
    
    // Check for calculator-related queries
    if ((content.toLowerCase().includes('calculate') || content.match(/\d+[\+\-\*\/]\d+/)) && 
        servers.some(server => server.tools.some(tool => tool.name.includes('calculate')))) {
      const calcServer = servers.find(server => 
        server.tools.some(tool => tool.name.includes('calculate'))
      );
      
      if (calcServer) {
        const calcTool = calcServer.tools.find(tool => 
          tool.name.includes('calculate')
        );
        
        if (calcTool) {
          // Extract expression from content (simplified)
          let expression = "1+1";
          const expressionMatch = content.match(/calculate\s+([0-9\+\-\*\/\(\)\s]+)/i);
          if (expressionMatch && expressionMatch[1]) {
            expression = expressionMatch[1].trim();
          } else {
            const directMatch = content.match(/([0-9]+[\+\-\*\/][0-9]+)/);
            if (directMatch && directMatch[1]) {
              expression = directMatch[1].trim();
            }
          }
          
          toolCalls.push({
            id: `tool-${Date.now() + 1}`,
            tool: calcTool.name,
            args: { expression },
            status: 'pending'
          });
        }
      }
    }
    
    return toolCalls;
  };

  const processToolCall = async (toolCall: ToolCall, assistantMessageId: string) => {
    try {
      // Find the server that has this tool
      const server = installedServers.find(server => 
        server.tools.some(tool => tool.name === toolCall.tool)
      );
      
      if (!server) {
        throw new Error(`No server found with tool: ${toolCall.tool}`);
      }
      
      // Call the tool
      const result = await callMCPTool(server.id, toolCall.tool, toolCall.args);
      
      // Update the tool call status
      setActiveToolCalls(prev => prev.map(tc => 
        tc.id === toolCall.id ? { ...tc, status: 'success', result: JSON.stringify(result) } : tc
      ));
      
      // Add tool result message
      const toolMessage: ChatMessage = {
        id: `tool-${Date.now()}`,
        role: 'tool',
        content: JSON.stringify(result),
        toolCallId: toolCall.id,
        createdAt: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, toolMessage]);
      
      // Simulate assistant follow-up response
      setTimeout(() => {
        const followUpMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: generateFollowUpResponse(toolCall.tool, result),
          createdAt: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, followUpMessage]);
      }, 1000);
      
    } catch (error) {
      console.error(`Error processing tool call ${toolCall.id}:`, error);
      
      // Update the tool call status to error
      setActiveToolCalls(prev => prev.map(tc => 
        tc.id === toolCall.id ? { ...tc, status: 'error', result: `Error: ${error}` } : tc
      ));
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: `tool-error-${Date.now()}`,
        role: 'tool',
        content: `Error calling ${toolCall.tool}: ${error}`,
        toolCallId: toolCall.id,
        createdAt: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const generateFollowUpResponse = (tool: string, result: any): string => {
    // This is a simplified simulation of assistant follow-up responses
    // In a real app, we would send the tool result back to the LLM for a proper response
    
    if (tool.includes('weather')) {
      return `Based on the weather data I retrieved, here's the information you requested. Let me know if you need any other details about the weather.`;
    }
    
    if (tool.includes('calculate')) {
      return `I've calculated the result for you. Is there anything else you'd like me to help you with?`;
    }
    
    return `I've processed your request using the ${tool} tool. Is there anything else you'd like to know?`;
  };

  const handleInstallServer = (server: MCPServer) => {
    // In a real app, this would save the server to the user's installed servers in a database
    setInstalledServers(prev => {
      // Check if already installed
      if (prev.some(s => s.id === server.id)) {
        return prev;
      }
      return [...prev, server];
    });
    
    setShowServerDialog(false);
  };

  const handleRemoveServer = (serverId: string) => {
    setInstalledServers(prev => prev.filter(server => server.id !== serverId));
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
                    variant={selectedModel === "gemini-2.0-pro" ? "default" : "outline"} 
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("gemini-2.0-pro")}
                  >
                    <div className="text-left">
                      <div className="font-medium">Gemini 2.0 Pro</div>
                      <div className="text-xs text-muted-foreground">Google's most capable model</div>
                    </div>
                  </Button>
                </TabsContent>
                <TabsContent value="openrouter" className="space-y-2 mt-2">
                  <Button 
                    variant={selectedModel === "openai/gpt-4" ? "default" : "outline"} 
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("openai/gpt-4")}
                  >
                    <div className="text-left">
                      <div className="font-medium">GPT-4</div>
                      <div className="text-xs text-muted-foreground">Via OpenRouter</div>
                    </div>
                  </Button>
                  <Button 
                    variant={selectedModel === "anthropic/claude-3-opus" ? "default" : "outline"} 
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("anthropic/claude-3-opus")}
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
            <CardContent className="flex-grow overflow-auto">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p>Start a conversation with the AI</p>
                    <div className="mt-4 space-y-2">
                      <p className="text-sm">Try asking:</p>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => setInput("What's the weather in New York?")}
                      >
                        What's the weather in New York?
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => setInput("Calculate 125 * 37")}
                      >
                        Calculate 125 * 37
                      </Button>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          message.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : message.role === 'tool'
                              ? 'bg-yellow-500/20 text-foreground border border-yellow-500/50'
                              : 'bg-muted text-foreground'
                        }`}
                      >
                        {message.role === 'tool' ? (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Tool Result:</div>
                            <div className="font-mono text-sm overflow-x-auto">
                              {message.content}
                            </div>
                          </div>
                        ) : message.toolCalls ? (
                          <div>
                            <div>{message.content}</div>
                            <div className="mt-2 border-t pt-2">
                              <div className="text-xs text-muted-foreground mb-1">Using tools:</div>
                              <div className="space-y-1">
                                {message.toolCalls.map(toolCall => (
                                  <div key={toolCall.id} className="text-sm">
                                    <span className="font-mono">{toolCall.tool}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      {JSON.stringify(toolCall.args)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          message.content
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted text-foreground">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce"></div>
                        <div className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce delay-75"></div>
                        <div className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce delay-150"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
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
