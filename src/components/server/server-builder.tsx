"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MCPTool } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define the callback type
type ToolsGeneratedCallback = (tools: MCPTool[], description: string) => void;

// Define the props type
interface ServerBuilderProps {
  onToolsGenerated?: ToolsGeneratedCallback;
}

export function ServerBuilder({ onToolsGenerated }: ServerBuilderProps) {
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTools, setGeneratedTools] = useState<MCPTool[]>([]);
  const [generationModel, setGenerationModel] = useState<"gemini-2.5-pro-exp-03-25" | "openai/gpt-4">("gemini-2.5-pro-exp-03-25");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

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
      
      // Call the callback function if provided
      if (onToolsGenerated) {
        // Use type assertion to tell TypeScript this is callable
        (onToolsGenerated as (tools: MCPTool[], desc: string) => void)(generatedTools, description);
      }
    } catch (error) {
      console.error("Error generating tools:", error);
      // Fallback to default tools if API fails
      const { createDefaultTools } = await import('@/lib/api/mcp');
      const fallbackTools = createDefaultTools(description);
      setGeneratedTools(fallbackTools);
      
      if (onToolsGenerated) {
        (onToolsGenerated as (tools: MCPTool[], desc: string) => void)(fallbackTools, description);
      }
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3">Categories</h3>
            <div className="space-y-2">
              {exampleCategories.map(category => (
                <Button 
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3">AI Model</h3>
            <div className="space-y-2">
              <Button 
                variant={generationModel === "gemini-2.5-pro-exp-03-25" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setGenerationModel("gemini-2.5-pro-exp-03-25")}
              >
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                  </svg>
                  <span>Gemini 2.5 Pro</span>
                </div>
              </Button>
              <Button 
                variant={generationModel === "openai/gpt-4" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setGenerationModel("openai/gpt-4")}
              >
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
                    <line x1="8" y1="16" x2="8.01" y2="16" />
                    <line x1="8" y1="20" x2="8.01" y2="20" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                    <line x1="12" y1="22" x2="12.01" y2="22" />
                    <line x1="16" y1="16" x2="16.01" y2="16" />
                    <line x1="16" y1="20" x2="16.01" y2="20" />
                  </svg>
                  <span>GPT-4</span>
                </div>
              </Button>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Create Your MCP Server</CardTitle>
              <CardDescription>
                Tell us what capabilities you want your AI to have, and we'll create the implementation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="I want to create a weather tool that can show current weather and forecasts for any city in the world"
                className="min-h-32 mb-4 w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              
              <div>
                <h3 className="text-sm font-medium mb-4">Or start with a template:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredExamples.map((example) => (
                    <Button 
                      key={example.id}
                      variant="outline" 
                      className="h-auto py-4 px-4 flex flex-col items-start space-y-2 hover:border-primary hover:bg-primary/5 transition-colors w-full"
                      onClick={() => setDescription(example.description)}
                    >
                      <div className="rounded-full bg-primary/10 p-2">
                        {getIconForExample(example.id)}
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{example.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 overflow-hidden text-ellipsis break-words w-full">{example.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={handleGenerate}
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
                ) : "Generate My AI Tools"}
              </Button>
            </CardFooter>
          </Card>
        </div>
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
                // Create a temporary function to avoid TypeScript errors
                const handleContinue = () => {
                  if (onToolsGenerated) {
                    // Use type assertion to tell TypeScript this is callable
                    (onToolsGenerated as (tools: MCPTool[], desc: string) => void)(generatedTools, description);
                  }
                };
                handleContinue();
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