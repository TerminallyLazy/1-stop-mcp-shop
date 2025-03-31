"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createMCPServer, generateMCPTools } from "@/lib/api/mcp";
import { MCPServer, MCPTool } from "@/lib/types";

export function ServerDeployment({ tools, description }: { tools: MCPTool[], description: string }) {
  const [serverName, setServerName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedServer, setDeployedServer] = useState<MCPServer | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const handleDeploy = async () => {
    if (!serverName.trim()) return;
    
    setIsDeploying(true);
    try {
      // In a real implementation, this would create and deploy the server
      const server = await createMCPServer(
        serverName,
        description,
        "user-123", // This would be the actual user ID from auth
        isPublic,
        tools
      );
      
      setDeployedServer(server);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Error deploying server:", error);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <>
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle>Deploy Your MCP Server</CardTitle>
          <CardDescription>
            Configure and deploy your MCP server to make it available to AI assistants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="server-name" className="text-sm font-medium">
                Server Name
              </label>
              <Input
                id="server-name"
                placeholder="My Weather Server"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Visibility</label>
              <div className="flex mt-1 space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={isPublic}
                    onChange={() => setIsPublic(true)}
                    className="h-4 w-4"
                  />
                  <span>Public</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={!isPublic}
                    onChange={() => setIsPublic(false)}
                    className="h-4 w-4"
                  />
                  <span>Private</span>
                </label>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Server Tools</h3>
              <div className="border rounded-lg p-4 space-y-3">
                {tools.map((tool) => (
                  <div key={tool.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                    <h4 className="font-medium">{tool.name}</h4>
                    <p className="text-sm text-muted-foreground">{tool.description}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Hosting Plan</h3>
              <Tabs defaultValue="free">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="free">Free</TabsTrigger>
                  <TabsTrigger value="premium">Premium</TabsTrigger>
                </TabsList>
                <TabsContent value="free" className="p-4 border rounded-lg mt-2">
                  <h4 className="font-medium">Free Plan</h4>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Server available for 5 minutes</li>
                    <li>• Limited to 3 servers</li>
                    <li>• Basic tools only</li>
                  </ul>
                </TabsContent>
                <TabsContent value="premium" className="p-4 border rounded-lg mt-2">
                  <h4 className="font-medium">Premium Plan</h4>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Permanent server hosting</li>
                    <li>• Unlimited servers</li>
                    <li>• Advanced tools and customization</li>
                    <li>• Priority support</li>
                  </ul>
                  <Button className="mt-4 w-full">Upgrade to Premium</Button>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={handleDeploy}
            disabled={isDeploying || !serverName.trim()}
          >
            {isDeploying ? "Deploying..." : "Deploy MCP Server"}
          </Button>
        </CardFooter>
      </Card>
      
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>MCP Server Deployed!</DialogTitle>
            <DialogDescription>
              Your MCP server has been successfully deployed and is now available.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border p-4 font-mono text-sm">
              {deployedServer && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Server ID:</span>
                    <span>{deployedServer.id}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-muted-foreground">URL:</span>
                    <span>https://agent.mcpify.ai/sse?server={deployedServer.id}</span>
                  </div>
                  {deployedServer.expiresAt && (
                    <div className="flex justify-between mt-2">
                      <span className="text-muted-foreground">Expires:</span>
                      <span>{new Date(deployedServer.expiresAt).toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
