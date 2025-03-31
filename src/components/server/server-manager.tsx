"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MCPServer } from "@/lib/types";
import { getUserSession, UserSession } from "@/lib/supabase";

export function ServerManager() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, this would fetch the user's servers from a database
    const fetchData = async () => {
      try {
        // Get user session
        const session = await getUserSession();
        setUserSession(session);
        
        // Simulate fetching servers
        const mockServers: MCPServer[] = [
          {
            id: "server-123",
            name: "Weather API Hub",
            description: "Multi-source weather data with forecasts and historical data",
            ownerId: session.user?.id || "unknown",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: true,
            expiresAt: session.subscription === "premium" 
              ? undefined 
              : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            tools: [{
              id: "tool-123",
              name: "get_weather",
              description: "Get current weather and forecast for a location",
              parameters: [
                {
                  name: "location",
                  type: "string",
                  description: "City name or coordinates",
                  required: true
                }
              ],
              serverId: "server-123",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }]
          }
        ];
        
        setServers(mockServers);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const getExpirationStatus = (server: MCPServer) => {
    if (!server.expiresAt) return { status: "permanent", text: "Permanent" };
    
    const expiresAt = new Date(server.expiresAt);
    const now = new Date();
    const minutesLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (60 * 1000)));
    
    if (minutesLeft <= 0) {
      return { status: "expired", text: "Expired" };
    } else if (minutesLeft < 1) {
      return { status: "expiring", text: "Expiring soon" };
    } else {
      return { status: "active", text: `${minutesLeft} minutes left` };
    }
  };

  const handleExtend = (serverId: string) => {
    // In a real implementation, this would extend the server's expiration time
    setServers(prev => prev.map(server => {
      if (server.id === serverId && server.expiresAt) {
        const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        return { ...server, expiresAt: newExpiresAt };
      }
      return server;
    }));
  };

  const handleUpgrade = () => {
    // In a real implementation, this would redirect to a payment page
    alert("This would redirect to a payment page to upgrade to premium");
  };

  return (
    <div className="container mx-auto py-6">
      <Card className="w-full mb-6">
        <CardHeader>
          <CardTitle>Your MCP Servers</CardTitle>
          <CardDescription>
            Manage your deployed MCP servers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading your servers...</div>
          ) : servers.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">You haven't created any MCP servers yet.</p>
              <Button className="mt-4">Create Your First Server</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {servers.map(server => {
                const expiration = getExpirationStatus(server);
                return (
                  <div key={server.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{server.name}</h3>
                        <p className="text-sm text-muted-foreground">{server.description}</p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs ${
                        expiration.status === "permanent" ? "bg-green-500/20 text-green-500" :
                        expiration.status === "active" ? "bg-blue-500/20 text-blue-500" :
                        expiration.status === "expiring" ? "bg-yellow-500/20 text-yellow-500" :
                        "bg-red-500/20 text-red-500"
                      }`}>
                        {expiration.text}
                      </div>
                    </div>
                    
                    <div className="mt-3 text-sm">
                      <div className="flex justify-between">
                        <span>Server URL:</span>
                        <span className="font-mono">https://agent.mcpify.ai/sse?server={server.id}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>Tools:</span>
                        <span>{server.tools.length}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>Visibility:</span>
                        <span>{server.isPublic ? "Public" : "Private"}</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex space-x-2">
                      {server.expiresAt && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleExtend(server.id)}
                        >
                          Extend (5 min)
                        </Button>
                      )}
                      <Button variant="outline" size="sm">Edit</Button>
                      <Button variant="outline" size="sm" className="text-red-500">Delete</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        {userSession?.subscription !== "premium" && (
          <CardFooter className="flex-col">
            <div className="w-full p-4 bg-primary/10 rounded-lg mb-4">
              <h3 className="font-medium mb-2">Free Plan Limitations</h3>
              <ul className="text-sm space-y-1">
                <li>• Servers expire after 5 minutes</li>
                <li>• Limited to 3 servers</li>
                <li>• Basic tools only</li>
              </ul>
              <Button className="w-full mt-4" onClick={handleUpgrade}>
                Upgrade to Premium
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
