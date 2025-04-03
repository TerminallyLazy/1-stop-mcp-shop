"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { callGeminiAPI } from "../../lib/api/gemini";
import { callOpenRouterAPI } from "../../lib/api/openrouter";
import { callMCPTool } from "../../lib/api/mcp";
import { ChatMessage, MCPServer, MCPTool } from "../../lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { X } from "lucide-react";

// Storage key for localStorage
const MCP_SERVERS_STORAGE_KEY = 'mcp-connected-servers';

export function MCPClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [connectedServers, setConnectedServers] = useState<MCPServer[]>([]);
  const [isServerDetailsOpen, setIsServerDetailsOpen] = useState(false);
  const [serverDetailsContent, setServerDetailsContent] = useState<MCPServer | null>(null);
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);
  const [newServerUrl, setNewServerUrl] = useState("");
  const [newServerConfig, setNewServerConfig] = useState("");
  const [addServerMethod, setAddServerMethod] = useState<'url' | 'config'>('url');

  // Load servers from localStorage on component mount
  useEffect(() => {
    const loadServers = () => {
      try {
        const storedServers = localStorage.getItem(MCP_SERVERS_STORAGE_KEY);
        if (storedServers) {
          const servers = JSON.parse(storedServers);
          setConnectedServers(servers);
        }
      } catch (error) {
        console.error("Error loading MCP servers from localStorage:", error);
      }
    };

    loadServers();
  }, []);

  // Save servers to localStorage whenever they change
  useEffect(() => {
    if (connectedServers.length > 0) {
      try {
        localStorage.setItem(MCP_SERVERS_STORAGE_KEY, JSON.stringify(connectedServers));
      } catch (error) {
        console.error("Error saving MCP servers to localStorage:", error);
      }
    }
  }, [connectedServers]);

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
        setMessages(prev => [...prev, response.message as ChatMessage]);
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
    }
  };

  const handleToolCall = async (tool: MCPTool, args: Record<string, any>) => {
    if (!selectedServer) return;
    
    try {
      const result = await callMCPTool(selectedServer.id, tool.name, args);
      
      // Add tool call message
      const toolMessage: ChatMessage = {
        id: `tool-${Date.now()}`,
        role: 'tool',
        content: JSON.stringify(result),
        createdAt: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, toolMessage]);
    } catch (error) {
      console.error("Error calling tool:", error);
    }
  };

  const handleServerClick = (server: MCPServer) => {
    setServerDetailsContent(server);
    setIsServerDetailsOpen(true);
  };

  const handleAddServer = async () => {
    try {
      // Make an API call to discover and connect to the server
      let serverData;
      if (addServerMethod === 'url') {
        // Connect via URL
        const response = await fetch('/api/mcp/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: newServerUrl })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to connect to server: ${response.status} ${response.statusText}`);
        }
        
        serverData = await response.json();
      } else {
        // Connect via config file
        try {
          // Parse the config JSON
          const config = JSON.parse(newServerConfig);
          
          // Make the API call to register the config
          const response = await fetch('/api/mcp/discover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to connect to server: ${response.status} ${response.statusText}`);
          }
          
          serverData = await response.json();
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Invalid JSON configuration: ${error.message}`);
          }
          throw new Error('Invalid JSON configuration');
        }
      }
      
      if (!serverData || !serverData.server) {
        throw new Error('Invalid server response');
      }
      
      // Add the new server to the list of connected servers
      setConnectedServers(prev => [...prev, serverData.server]);
      
      // Close the dialog
      setIsAddServerOpen(false);
      
      // Reset form fields
      setNewServerUrl('');
      setNewServerConfig('');
    } catch (error: unknown) {
      console.error("Error adding server:", error);
      if (error instanceof Error) {
        alert(`Error adding server: ${error.message}`);
      } else {
        alert('Error adding server: An unknown error occurred');
      }
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
                {connectedServers.length > 0 ? (
                  connectedServers.map(server => (
                    <Button 
                      key={server.id}
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => handleServerClick(server)}
                    >
                      <div className="text-left">
                        <div className="font-medium">{server.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {server.tools.length} tools
                        </div>
                      </div>
                    </Button>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">No MCP servers connected</p>
                    <p className="text-xs text-muted-foreground mt-1">Use "Add Server" to connect to an MCP server</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => setIsAddServerOpen(true)}>
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
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-3">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Chat</CardTitle>
              <CardDescription>
                Interact with AI using MCP tools
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-auto">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Start a conversation with the AI
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
                        {message.content}
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

      {/* Server Details Dialog */}
      <Dialog open={isServerDetailsOpen} onOpenChange={setIsServerDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{serverDetailsContent?.name}</DialogTitle>
            <DialogDescription>
              {serverDetailsContent?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <h3 className="text-sm font-medium mb-2">Available Tools</h3>
            <div className="space-y-4">
              {serverDetailsContent?.tools.map(tool => (
                <div key={tool.id} className="border rounded-md p-3">
                  <h4 className="font-medium">{tool.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
                  
                  {tool.parameters.length > 0 && (
                    <div className="mt-2">
                      <h5 className="text-xs font-medium mb-1">Parameters:</h5>
                      <div className="space-y-1">
                        {tool.parameters.map((param, index) => (
                          <div key={index} className="text-xs">
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
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                setSelectedServer(serverDetailsContent);
                setIsServerDetailsOpen(false);
              }}
            >
              Use This Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Server Dialog */}
      <Dialog open={isAddServerOpen} onOpenChange={setIsAddServerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add MCP Server</DialogTitle>
            <DialogDescription>
              Connect to a Model Context Protocol server
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex space-x-2">
              <Button 
                variant={addServerMethod === 'url' ? 'default' : 'outline'}
                onClick={() => setAddServerMethod('url')}
                className="flex-1"
              >
                Connect via URL
              </Button>
              <Button 
                variant={addServerMethod === 'config' ? 'default' : 'outline'}
                onClick={() => setAddServerMethod('config')}
                className="flex-1"
              >
                Use Config File
              </Button>
            </div>

            {addServerMethod === 'url' ? (
              <div>
                <Label htmlFor="server-url">Server URL</Label>
                <Input 
                  id="server-url" 
                  value={newServerUrl} 
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  placeholder="https://example.com/mcp"
                  className="mt-1"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="server-config">Server Configuration</Label>
                <Textarea
                  id="server-config"
                  value={newServerConfig}
                  onChange={(e) => setNewServerConfig(e.target.value)}
                  placeholder={`{\n  "id": "server-id",\n  "name": "My MCP Server",\n  "description": "Description of the server",\n  "transport_types": ["stdio", "sse"]\n}`}
                  className="mt-1 font-mono text-sm h-32"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              onClick={handleAddServer}
              disabled={(addServerMethod === 'url' && !newServerUrl) || 
                       (addServerMethod === 'config' && !newServerConfig)}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
