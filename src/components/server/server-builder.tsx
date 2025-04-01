"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MCPTool } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define the callback type explicitly
interface ServerBuilderProps {
  onToolsGenerated?: (tools: MCPTool[], description: string) => void;
}

export function ServerBuilder({ onToolsGenerated }: ServerBuilderProps) {
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTools, setGeneratedTools] = useState<MCPTool[]>([]);
  const [generationModel, setGenerationModel] = useState<"gemini-2.5-pro-exp-03-25" | "openai/gpt-4">("gemini-2.5-pro-exp-03-25");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [messages, setMessages] = useState<{role: "ai" | "user", content: string}[]>([]);
  const [userInput, setUserInput] = useState("");

  const exampleCategories = [
    { id: "all", name: "All Templates" },
    { id: "data", name: "Data Retrieval" },
    { id: "utilities", name: "Utilities" },
    { id: "apis", name: "External APIs" }
  ];

  const examples = [
    { 
      id: "calculator", 
      name: "Smart Calculator", 
      description: "Math operations and unit conversions",
      category: "utilities",
      icon: "calculator"
    },
    {
      id: "weather",
      name: "Weather API Hub",
      description: "Current weather and forecasts for any city",
      category: "apis",
      icon: "weather"
    },
    {
      id: "finance",
      name: "Finance Toolkit",
      description: "Stock prices, exchange rates, market data",
      category: "apis",
      icon: "finance"
    },
    {
      id: "search",
      name: "Web Search",
      description: "Find information on the internet",
      category: "data",
      icon: "search"
    },
    {
      id: "database",
      name: "Database Query",
      description: "Query and return structured data",
      category: "data",
      icon: "database"
    },
    {
      id: "translator",
      name: "Language Translator",
      description: "Translate between multiple languages",
      category: "utilities",
      icon: "translator"
    }
  ];
  const filteredExamples = selectedCategory === "all" 
    ? examples 
    : examples.filter(example => example.category === selectedCategory);

  const handleExampleClick = (example: typeof examples[0]) => {
    setDescription(example.description);
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;
    
    setIsGenerating(true);
    try {
      // Import the generateMCPTools function
      const { generateMCPTools } = await import('@/lib/api/mcp');
      
      // Use the real API with the configured model
      const generatedTools = await generateMCPTools(description, generationModel);
      
      // Update state with the real generated tools
      setGeneratedTools(generatedTools);
      
      // Add AI message about the tools generated
      addAiMessage(generatedTools);
      
      // Don't auto-trigger the callback to move to deployment
      // Let the user explicitly click the Deploy button
    } catch (error) {
      console.error("Error generating tools:", error);
      // Fallback to default tools if API fails
      const { createDefaultTools } = await import('@/lib/api/mcp');
      const fallbackTools = createDefaultTools(description);
      setGeneratedTools(fallbackTools);
      
      // Add AI message about the tools generated (fallback)
      addAiMessage(fallbackTools);
      setMessages(prev => [...prev, { role: 'ai', content: 'Note: I used default tools because there was an issue connecting to the AI service.' }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Icons mapping based on keywords in the description
  const getIconForExample = (id: string) => {
    switch (id) {
      case "calculator":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <rect width="16" height="20" x="4" y="2" rx="2" />
            <line x1="8" x2="16" y1="6" y2="6" />
            <line x1="8" x2="8" y1="14" y2="18" />
            <line x1="12" x2="12" y1="14" y2="18" />
            <line x1="16" x2="16" y1="14" y2="18" />
            <line x1="8" x2="16" y1="10" y2="10" />
          </svg>
        );
      case "weather":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 14.5a4.5 4.5 0 0 0 4 4.5h9.5Z" />
          </svg>
        );
      case "finance":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <line x1="12" x2="12" y1="2" y2="22" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        );
      case "search":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        );
      case "database":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        );
      case "translator":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <path d="m5 8 6 6" />
            <path d="m4 14 6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="m22 22-5-10-5 10" />
            <path d="M14 18h6" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        );
    }
  };

  // Add a simulated message from AI when tools are generated
  const addAiMessage = (tools: MCPTool[]) => {
    const toolNamesList = tools.map(t => `'${t.name}'`).join(', ');
    setMessages(prev => [
      ...prev, 
      { 
        role: 'ai', 
        content: `I've created the following tools based on your requirements: ${toolNamesList}. You can view and modify them in the panel on the right.` 
      }
    ]);
  };

  // Handle user message submission
  const handleMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userInput }]);
    
    // Store the input in description for tool generation
    setDescription(userInput);
    
    // Clear input field
    setUserInput('');
    
    // Simulate AI is thinking
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content: 'I\'m generating MCP tools based on your requirements...' }]);
      // Generate tools
      handleGenerate();
    }, 1000);
  };

  // Modify handleGenerate to add AI message with tool info
  const originalHandleGenerate = handleGenerate;
  const enhancedHandleGenerate = async () => {
    try {
      await originalHandleGenerate();
      // The tools will be set in state by originalHandleGenerate
      // We'll add an AI message in the success branch of that function
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: `I encountered an error while generating tools: ${error}` }]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-12rem)]">
      {/* Left Side - Chat Interface */}
      <div className="border rounded-lg flex flex-col overflow-hidden">
        <div className="bg-primary/5 p-3 border-b">
          <h3 className="font-medium">Chat with AI to Build Your MCP Server</h3>
        </div>
        
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Describe what tools you want your MCP server to have.</p>
              <p className="text-sm mt-2">Example: "I need a weather API that can show current conditions and forecasts."</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-lg max-w-[80%] px-4 py-2 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Input area */}
        <form onSubmit={handleMessageSubmit} className="border-t p-3 flex gap-2">
          <Input 
            value={userInput} 
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserInput(e.target.value)} 
            placeholder="Describe the tools you want..."
            className="flex-1"
          />
          <Button type="submit" disabled={isGenerating || !userInput.trim()}>
            {isGenerating ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            )}
          </Button>
        </form>
      </div>
      
      {/* Right Side - Tools Panel */}
      <div className="border rounded-lg flex flex-col overflow-hidden">
        <div className="bg-primary/5 p-3 border-b flex justify-between items-center">
          <h3 className="font-medium">MCP Tools</h3>
          <div className="flex gap-2">
            <select 
              className="text-sm border rounded px-2 py-1 bg-background" 
              value={generationModel}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGenerationModel(e.target.value as "gemini-2.5-pro-exp-03-25" | "openai/gpt-4")}
            >
              <option value="gemini-2.5-pro-exp-03-25">Gemini 2.5 Pro</option>
              <option value="openai/gpt-4">GPT-4</option>
            </select>
            
            {generatedTools.length > 0 && (
              <Button 
                size="sm" 
                onClick={() => {
                  // Handle the callback safely with proper typing
                  if (typeof onToolsGenerated === 'function') {
                    (onToolsGenerated as (tools: MCPTool[], desc: string) => void)(generatedTools, description);
                  } else {
                    console.error('onToolsGenerated callback is not provided');
                  }
                }}
                className="text-xs"
              >
                Deploy
              </Button>
            )}
          </div>
        </div>
        
        {/* Tools display area */}
        <div className="flex-1 overflow-y-auto p-4">
          {generatedTools.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Your MCP tools will appear here once generated</p>
            </div>
          ) : (
            <div className="space-y-4">
              {generatedTools.map((tool) => (
                <div key={tool.id} className="border rounded-lg">
                  <div className="flex items-center p-3 bg-muted/50 border-b">
                    <div className="rounded-full bg-primary/10 p-1.5 mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{tool.name}</h4>
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                    </div>
                    <div className="bg-primary/10 text-primary text-xs py-1 px-2 rounded-full">
                      {tool.parameters.length} {tool.parameters.length === 1 ? 'parameter' : 'parameters'}
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <h5 className="text-sm font-medium">Parameters:</h5>
                    {tool.parameters.map((param) => (
                      <div key={param.name} className="flex flex-col bg-muted/30 p-2 rounded">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono bg-background px-1 py-0.5 rounded">{param.name}</code>
                            <span className="text-xs text-primary border border-primary/20 bg-primary/5 px-1 rounded">{param.type}</span>
                            {param.required && <span className="text-xs text-red-500">required</span>}
                          </div>
                          {param.enum && (
                            <div className="text-xs text-muted-foreground">Options: {param.enum.join(', ')}</div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{param.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Action buttons for empty state */}
        {generatedTools.length === 0 && (
          <div className="border-t p-3">
            <Button 
              className="w-full" 
              onClick={() => {
                // Add a user message if chat is empty
                if (messages.length === 0) {
                  setMessages([{ role: 'user', content: description || 'Generate MCP tools for me' }]);
                }
                handleGenerate();
              }}
              disabled={isGenerating || !description.trim()}
            >
              {isGenerating ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generating...</span>
                </div>
              ) : "Generate MCP Tools"}
            </Button>
          </div>
        )}
      </div>
      
      {generatedTools.length > 0 && !onToolsGenerated && (
        <Card className="w-full mt-6">
          <CardHeader>
            <CardTitle>Generated Tools</CardTitle>
            <CardDescription>
              Your MCP Server has been created with the following tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {generatedTools.map((tool) => (
                <div key={tool.id} className="border rounded-lg p-4">
                  <h3 className="font-medium">{tool.name}</h3>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                  <div className="mt-2">
                    <h4 className="text-sm font-medium">Parameters:</h4>
                    <ul className="mt-1 space-y-1">
                      {tool.parameters.map((param) => (
                        <li key={param.name} className="text-sm">
                          <span className="font-mono">{param.name}</span>
                          <span className="text-muted-foreground"> ({param.type})</span>
                          {param.required && <span className="text-red-500">*</span>}
                          <span className="text-muted-foreground"> - {param.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full"
              onClick={() => {
                console.log('Continue to Deployment clicked with tools:', generatedTools);
                // Handle the callback safely with proper typing
                if (typeof onToolsGenerated === 'function') {
                  (onToolsGenerated as (tools: MCPTool[], desc: string) => void)(generatedTools, description);
                } else {
                  console.error('onToolsGenerated callback is not provided');
                }
              }}
            >
              Continue to Deployment
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}