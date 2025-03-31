"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateMCPTools } from "@/lib/api/mcp";
import { MCPTool } from "@/lib/types";

export function ServerBuilder({ onToolsGenerated }: { onToolsGenerated?: (tools: MCPTool[], description: string) => void }) {
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTools, setGeneratedTools] = useState<MCPTool[]>([]);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    
    setIsGenerating(true);
    try {
      const tools = await generateMCPTools(description);
      setGeneratedTools(tools);
      
      // Call the callback function if provided
      if (onToolsGenerated) {
        onToolsGenerated(tools, description);
      }
    } catch (error) {
      console.error("Error generating tools:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create Your MCP Server</CardTitle>
          <CardDescription>
            Tell us what capabilities you want your AI to have, and we'll create the implementation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="I want to create a weather tool that can show current weather and forecasts for any city in the world"
            className="min-h-32"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Start with one of these examples:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 px-4"
                onClick={() => setDescription("Create a smart calculator that can perform advanced math operations and unit conversions")}
              >
                <div className="text-left">
                  <div className="font-medium">Smart Calculator</div>
                  <div className="text-sm text-muted-foreground">Advanced math operations</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 px-4"
                onClick={() => setDescription("Create a weather tool that can show current weather and forecasts for any city in the world")}
              >
                <div className="text-left">
                  <div className="font-medium">Weather API Hub</div>
                  <div className="text-sm text-muted-foreground">Multi-source weather data</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 px-4"
                onClick={() => setDescription("Create a finance toolkit that can fetch stock prices, currency exchange rates, and market data")}
              >
                <div className="text-left">
                  <div className="font-medium">Finance Toolkit</div>
                  <div className="text-sm text-muted-foreground">Markets and currency APIs</div>
                </div>
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={handleGenerate}
            disabled={isGenerating || !description.trim()}
          >
            {isGenerating ? "Generating..." : "Generate My AI Tools"}
          </Button>
        </CardFooter>
      </Card>

      {generatedTools.length > 0 && (
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
            <Button className="w-full">Deploy MCP Server</Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
