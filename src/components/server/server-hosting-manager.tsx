"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { MCPServer } from "../../lib/types";
import { getUserSession, supabase, UserSession } from "../../lib/supabase";

export function ServerHostingManager() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [serverTimers, setServerTimers] = useState<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    // In a real implementation, this would fetch the user's servers from a database
    const fetchData = async () => {
      try {
        // Get user session
        const session = await getUserSession();
        setUserSession(session);
        
        // Fetch servers from backend
        try {
          const { data: serverData, error: serverError } = await supabase
            .from('mcp_servers')
            .select('*')
            .eq('owner_id', session?.user?.id || '')
            .order('created_at', { ascending: false });
            
          if (serverError) {
            console.error('Failed to fetch servers:', serverError.message);
            setServers([]);
            return;
          }
          
          // Fetch tools for these servers
          const { data: toolsData, error: toolsError } = await supabase
            .from('mcp_tools')
            .select('*')
            .in('server_id', serverData.map((s: { id: any; }) => s.id));
            
          if (toolsError) {
            console.error('Failed to fetch tools:', toolsError.message);
          }
          
          // Map server data
          const mappedServers: MCPServer[] = serverData.map((server: { id: any; name: any; description: any; owner_id: any; created_at: any; updated_at: any; is_public: any; expires_at: any; schema_version: any; transport_types: any; capabilities: any; }) => {
            const serverTools = (toolsData || [])
              .filter((tool: { server_id: any; }) => tool.server_id === server.id)
              .map((tool: { id: any; name: any; description: any; parameters: any; server_id: any; created_at: any; updated_at: any; }) => ({
                id: tool.id,
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters || [],
                serverId: tool.server_id,
                createdAt: tool.created_at,
                updatedAt: tool.updated_at
              }));
              
            return {
              id: server.id,
              name: server.name,
              description: server.description,
              ownerId: server.owner_id,
              createdAt: server.created_at,
              updatedAt: server.updated_at,
              isPublic: server.is_public,
              expiresAt: server.expires_at,
              tools: serverTools,
              resources: [],
              prompts: [],
              schemaVersion: server.schema_version || "2025-03-26",
              transportTypes: server.transport_types || ["sse", "stdio"],
              capabilities: server.capabilities || {
                tools: serverTools.length > 0,
                resources: false,
                prompts: false,
                sampling: false
              }
            };
          });
          
          setServers(mappedServers);
        } catch (error) {
          console.error('Error fetching servers:', error);
          setServers([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Cleanup timers on unmount
    return () => {
      Object.values(serverTimers).forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Set up timers for servers with expiration
  useEffect(() => {
    // Clear existing timers
    Object.values(serverTimers).forEach(timer => clearTimeout(timer));
    const newTimers: Record<string, NodeJS.Timeout> = {};
    
    servers.forEach(server => {
      if (server.expiresAt) {
        const expiresAt = new Date(server.expiresAt).getTime();
        const now = Date.now();
        const timeLeft = Math.max(0, expiresAt - now);
        
        if (timeLeft > 0) {
          // Set timer to update UI when server expires
          newTimers[server.id] = setTimeout(() => {
            setServers(prev => prev.map(s => 
              s.id === server.id ? { ...s, expiresAt: new Date().toISOString() } : s
            ));
          }, timeLeft);
        }
      }
    });
    
    setServerTimers(newTimers);
  }, [servers]);

  const getExpirationStatus = (server: MCPServer) => {
    if (!server.expiresAt) return { status: "permanent", text: "Permanent" };
    
    const expiresAt = new Date(server.expiresAt);
    const now = new Date();
    const minutesLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (60 * 1000)));
    const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000) % 60);
    
    if (minutesLeft <= 0 && secondsLeft <= 0) {
      return { status: "expired", text: "Expired" };
    } else if (minutesLeft < 1) {
      return { status: "expiring", text: `${secondsLeft}s left` };
    } else {
      return { status: "active", text: `${minutesLeft}m ${secondsLeft}s left` };
    }
  };

  const handleExtend = async (serverId: string) => {
    try {
      // Update the UI immediately for better UX
      const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      setServers(prev => prev.map(server => {
        if (server.id === serverId) {
          return { ...server, expiresAt: newExpiresAt };
        }
        return server;
      }));
      
      // Update in the database
      const { error } = await supabase
        .from('mcp_servers')
        .update({ 
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString() 
        })
        .eq('id', serverId);
        
      if (error) {
        console.error('Error extending server:', error);
        // Revert UI if update failed
        setServers(prev => [...prev]); // Trigger re-fetch
      }
    } catch (error) {
      console.error('Error extending server:', error);
    }
  };

  const handleUpgrade = () => {
    setShowUpgradeDialog(true);
  };

  const handleRestartServer = async (serverId: string) => {
    try {
      const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      
      // Update UI immediately
      setServers(prev => prev.map(server => {
        if (server.id === serverId) {
          return { ...server, expiresAt: newExpiresAt };
        }
        return server;
      }));
      
      // Update in the database and restart the server process
      const { error } = await supabase
        .from('mcp_servers')
        .update({ 
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
          status: 'running' 
        })
        .eq('id', serverId);
        
      if (error) {
        console.error('Error restarting server:', error);
        // Handle error and revert UI
        setServers(prev => [...prev]); // Trigger re-fetch
      }
    } catch (error) {
      console.error('Error restarting server:', error);
    }
  };

  return (
    <>
      <Card className="w-full mb-6">
        <CardHeader>
          <CardTitle>Server Hosting</CardTitle>
          <CardDescription>
            Manage your deployed MCP servers and hosting settings
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
                        <span className="font-mono">{window.location.origin}/api/mcp/{server.id}</span>
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
                      {expiration.status === "expired" ? (
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleRestartServer(server.id)}
                        >
                          Restart Server
                        </Button>
                      ) : server.expiresAt ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleExtend(server.id)}
                        >
                          Extend (5 min)
                        </Button>
                      ) : null}
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
      
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to Premium</DialogTitle>
            <DialogDescription>
              Get unlimited server hosting and more powerful features
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium">Premium Plan Features</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Permanent server hosting</li>
                  <li>• Unlimited servers</li>
                  <li>• Advanced tools and customization</li>
                  <li>• Priority support</li>
                </ul>
                <div className="mt-4">
                  <div className="text-2xl font-bold">$9.99 / month</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="card-number" className="text-sm font-medium">
                  Card Number
                </label>
                <Input id="card-number" placeholder="4242 4242 4242 4242" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="expiry" className="text-sm font-medium">
                    Expiry Date
                  </label>
                  <Input id="expiry" placeholder="MM/YY" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="cvc" className="text-sm font-medium">
                    CVC
                  </label>
                  <Input id="cvc" placeholder="123" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>Cancel</Button>
            <Button>Subscribe Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
