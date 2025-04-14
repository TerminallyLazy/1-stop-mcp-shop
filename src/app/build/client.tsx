"use client";

import { useState } from "react";
import { ServerBuilder } from "../../components/server/server-builder";
import { ServerDeployment } from "../../components/server/server-deployment";
import { MCPTool } from "../../lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";

export default function BuildPageClient() {
  const [generatedTools, setGeneratedTools] = useState<MCPTool[]>([]);
  const [description, setDescription] = useState("");
  const [activeTab, setActiveTab] = useState("build");
  const [deployStatus, setDeployStatus] = useState<"pending" | "deployed" | "failed">("pending");

  // Function to receive tools from ServerBuilder component
  const handleToolsGenerated = (tools: MCPTool[], desc: string) => {
    setGeneratedTools(tools);
    setDescription(desc);
    setActiveTab("deploy");
  };

  // Function to handle deployment success
  const handleDeploySuccess = () => {
    setDeployStatus("deployed");
    setActiveTab("complete");
  };

  // Function to handle deployment failure
  const handleDeployFailure = () => {
    setDeployStatus("failed");
  };

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-2">Build MCP Servers</h1>
      <p className="text-center text-muted-foreground mb-8">
        Create powerful MCP servers that enable AI assistants to perform tasks for your users.<br />
        Just describe what you want, and we'll generate the tools and API implementations.
      </p>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="build" disabled={activeTab === "complete"}>1. Build</TabsTrigger>
              <TabsTrigger value="deploy" disabled={generatedTools.length === 0 || activeTab === "complete"}>2. Deploy</TabsTrigger>
              <TabsTrigger value="complete" disabled={deployStatus !== "deployed"}>3. Complete</TabsTrigger>
            </TabsList>
            
            <TabsContent value="build" className="pt-6">
              <ServerBuilder onToolsGenerated={handleToolsGenerated} />
            </TabsContent>
          
            <TabsContent value="deploy" className="pt-6">
              {generatedTools.length > 0 && (
                <ServerDeployment 
                  tools={generatedTools} 
                  description={description} 
                  onDeploySuccess={handleDeploySuccess}
                  onDeployFailure={handleDeployFailure}
                />
              )}
            </TabsContent>
          
            <TabsContent value="complete" className="pt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center text-green-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-10 w-10 mx-auto mb-2"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Your MCP Server is Ready!
                  </CardTitle>
                  <CardDescription className="text-center">
                    Your AI server has been deployed and is ready to use.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-2">Next Steps</h3>
                      <ol className="list-decimal pl-5 space-y-2">
                        <li>Go to the <span className="font-medium">Manage</span> page to monitor and control your server</li>
                        <li>Use your server in the <span className="font-medium">Client</span> page to interact with it</li>
                        <li>Share your server with the community in the <span className="font-medium">Marketplace</span></li>
                      </ol>
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-2">How to Use Your Server</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Your MCP server can be used by AI assistants like Claude, ChatGPT, and others.
                        Here's how to use it:
                      </p>
                      <div className="bg-muted p-3 rounded font-mono text-sm overflow-x-auto">
                        <p>1. In your conversation with an AI, mention:</p>
                        <p className="mt-2">"Please use the MCP server at https://agent.mcpify.ai/sse?server={generatedTools.length > 0 ? generatedTools[0].serverId : 'your-server-id'}"</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => {
                    setGeneratedTools([]);
                    setDescription("");
                    setActiveTab("build");
                    setDeployStatus("pending");
                  }}>
                    Create Another Server
                  </Button>
                  <Button>Go to Manage Servers</Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}