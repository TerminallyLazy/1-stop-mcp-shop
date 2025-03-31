"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { callGeminiAPI } from "@/lib/api/gemini";
import { callOpenRouterAPI } from "@/lib/api/openrouter";
import { callMCPTool } from "@/lib/api/mcp";
import { ChatMessage, MCPServer, MCPTool } from "@/lib/types";

export function MCPClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);

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

  return (
    <div className="container mx-auto py-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>MCP Servers</CardTitle>
              <CardDescription>
                Connect to MCP servers to extend AI capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <div className="text-left">
                    <div className="font-medium">Weather API Hub</div>
                    <div className="text-xs text-muted-foreground">Multi-source weather data</div>
                  </div>
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <div className="text-left">
                    <div className="font-medium">Smart Calculator</div>
                    <div className="text-xs text-muted-foreground">Advanced math operations</div>
                  </div>
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <div className="text-left">
                    <div className="font-medium">Finance Toolkit</div>
                    <div className="text-xs text-muted-foreground">Markets and currency APIs</div>
                  </div>
                </Button>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">
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
    </div>
  );
}
