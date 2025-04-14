"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { MCPServer, MCPTool } from "../../lib/types";
import { getUserSession } from "../../lib/supabase";

interface ServerDeploymentProps {
  tools: MCPTool[];
  description: string;
  onDeploySuccess?: () => void;
  onDeployFailure?: () => void;
}

export function ServerDeployment({ 
  tools, 
  description, 
  onDeploySuccess, 
  onDeployFailure 
}: ServerDeploymentProps) {
  const [serverName, setServerName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedServer, setDeployedServer] = useState<MCPServer | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<"free" | "premium">("free");
  const [error, setError] = useState<string | null>(null);

  // Simulates a progress update during deployment
  const simulateProgress = () => {
    setDeploymentProgress(0);
    const interval = setInterval(() => {
      setDeploymentProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 400);
    return interval;
  };

  const handleDeploy = async () => {
    if (!serverName.trim()) return;
    
    setIsDeploying(true);
    setError(null);
    
    // Start the progress animation
    const progressInterval = simulateProgress();
    
    try {
      // Get the current user session
      const session = await getUserSession();
      const userId = session?.user?.id || 'anonymous-user';
      
      // Create a mock server (simulates server creation)
      const now = new Date().toISOString();
      const isPremium = session?.subscription === 'premium';
      const expiresAt = isPremium ? undefined : new Date(Date.now() + 5 * 60 * 1000).toISOString();
      
      const server: MCPServer = {
        id: `server-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: serverName,
        description: description,
        ownerId: userId,
        createdAt: now,
        updatedAt: now,
        isPublic,
        expiresAt,
        tools: tools.map(tool => ({
          ...tool,
          serverId: `server-${Date.now()}`,
        })),
        resources: [],
        prompts: [],
        schemaVersion: "2025-03-26",
        transportTypes: ["sse", "stdio"],
        capabilities: {
          tools: tools.length > 0,
          resources: false,
          prompts: false,
          sampling: false
        }
      };
      
      // Ensure progress is complete for visual feedback
      setTimeout(() => {
        clearInterval(progressInterval);
        setDeploymentProgress(100);
        setDeployedServer(server);
        setShowSuccessDialog(true);
        
        if (onDeploySuccess) {
          onDeploySuccess();
        }
      }, 1500);
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Error deploying server:", error);
      setError(error instanceof Error ? error.message : "Failed to deploy server");
      
      if (onDeployFailure) {
        onDeployFailure();
      }
    } finally {
      setTimeout(() => {
        setIsDeploying(false);
      }, 1500);
    }
  };

  // Generate a suggested server name based on the tools
  const suggestServerName = () => {
    if (tools.length === 0) return "";
    
    const mainTool = tools[0];
    const name = mainTool.name;
    
    if (name.includes('weather')) return 'WeatherAPI Server';
    if (name.includes('calculate')) return 'Calculator Server';
    if (name.includes('finance') || name.includes('stock')) return 'Finance Data Server';
    if (name.includes('search')) return 'Web Search Server';
    if (name.includes('translate')) return 'Translation Server';
    
    return `${name.charAt(0).toUpperCase() + name.slice(1)} Server`;
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Deploy Your MCP Server</CardTitle>
          <CardDescription>
            Configure and deploy your MCP server to make it available to AI assistants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <label htmlFor="server-name" className="text-sm font-medium">
                Server Name
              </label>
              <Input
                id="server-name"
                placeholder={suggestServerName()}
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Choose a descriptive name for your server to easily find it later
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium">Server Visibility</label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Button 
                  type="button" 
                  variant={isPublic ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setIsPublic(true)}
                >
                  <div className="flex flex-col items-start">
                    <span>Public</span>
                    <span className="text-xs text-muted-foreground">Visible in marketplace</span>
                  </div>
                </Button>
                <Button 
                  type="button" 
                  variant={!isPublic ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setIsPublic(false)}
                >
                  <div className="flex flex-col items-start">
                    <span>Private</span>
                    <span className="text-xs text-muted-foreground">Only for your use</span>
                  </div>
                </Button>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Server Tools</h3>
              <div className="border rounded-lg p-4 space-y-3">
                {tools.map((tool) => (
                  <div key={tool.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{tool.name}</h4>
                        <p className="text-sm text-muted-foreground">{tool.description}</p>
                      </div>
                      <div className="bg-primary/10 text-primary text-xs py-1 px-2 rounded-full">
                        {tool.parameters.length} {tool.parameters.length === 1 ? 'parameter' : 'parameters'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Hosting Plan</h3>
              <Tabs defaultValue={currentPlan} onValueChange={(value: string) => setCurrentPlan(value as "free" | "premium")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="free">Free</TabsTrigger>
                  <TabsTrigger value="premium">Premium</TabsTrigger>
                </TabsList>
                <TabsContent value="free" className="p-4 border rounded-lg mt-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">Free Plan</h4>
                      <p className="text-sm text-muted-foreground">For getting started</p>
                    </div>
                    <span className="text-lg font-bold">$0</span>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 mr-2 text-green-500"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Server available for 5 minutes
                    </li>
                    <li className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 mr-2 text-green-500"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Limited to 3 servers
                    </li>
                    <li className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 mr-2 text-green-500"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Basic tools only
                    </li>
                    <li className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 mr-2 text-green-500"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Community support
                    </li>
                  </ul>
                </TabsContent>
                <TabsContent value="premium" className="p-4 border rounded-lg mt-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">Premium Plan</h4>
                      <p className="text-sm text-muted-foreground">For serious users</p>
                    </div>
                    <span className="text-lg font-bold">$9.99<span className="text-sm text-muted-foreground">/mo</span></span>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 mr-2 text-green-500"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Permanent server hosting
                    </li>
                    <li className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 mr-2 text-green-500"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Unlimited servers
                    </li>
                    <li className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 mr-2 text-green-500"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Advanced tools and customization
                    </li>
                    <li className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 mr-2 text-green-500"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Priority support
                    </li>
                    <li className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 mr-2 text-green-500"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Usage analytics
                    </li>
                  </ul>
                  <Button className="mt-4 w-full">Upgrade to Premium</Button>
                </TabsContent>
              </Tabs>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          {isDeploying && (
            <div className="w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span>Deploying server...</span>
                <span>{deploymentProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${deploymentProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {!isDeploying && (
            <Button 
              className="w-full" 
              onClick={handleDeploy}
              disabled={!serverName.trim()}
            >
              Deploy MCP Server
            </Button>
          )}
        </CardFooter>
      </Card>
      
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
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
                className="h-5 w-5 text-green-500"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Server Deployed Successfully!
            </DialogTitle>
            <DialogDescription>
              Your MCP server is now online and ready to use
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 border rounded-lg bg-muted/40">
            <h3 className="text-sm font-medium mb-2">Server Details</h3>
            {deployedServer && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Server ID:</span>
                  <code className="bg-muted px-1 py-0.5 rounded">{deployedServer.id}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span>{deployedServer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tools:</span>
                  <span>{deployedServer.tools.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visibility:</span>
                  <span>{deployedServer.isPublic ? 'Public' : 'Private'}</span>
                </div>
                {deployedServer.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires:</span>
                    <span>{new Date(deployedServer.expiresAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="bg-muted p-3 rounded text-sm">
            <p className="font-medium mb-1">Usage Instructions:</p>
            <p className="text-muted-foreground mb-2">In your conversation with an AI assistant, simply say:</p>
            <code className="block bg-background p-2 rounded border whitespace-normal break-all">
              Please use the MCP server at {window.location.origin}/api/mcp/{deployedServer?.id || '[server-id]'}
            </code>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/api/mcp/${deployedServer?.id || ""}`);
              }}
              className="sm:flex-1"
            >
              Copy URL
            </Button>
            <Button onClick={() => setShowSuccessDialog(false)} className="sm:flex-1">
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}