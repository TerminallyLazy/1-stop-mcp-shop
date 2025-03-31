"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MCPServer } from "@/lib/types";
import { listMCPServers } from "@/lib/api/mcp";

export function MarketplaceClient() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [categories, setCategories] = useState<string[]>([
    "All",
    "Weather",
    "Finance",
    "Productivity",
    "Development",
    "Health"
  ]);
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const serverList = await listMCPServers();
        setServers(serverList);
      } catch (error) {
        console.error("Error fetching servers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, []);

  const handleInstall = (server: MCPServer) => {
    setSelectedServer(server);
    setShowInstallDialog(true);
  };

  const confirmInstall = () => {
    // In a real implementation, this would add the server to the user's installed servers
    console.log(`Installing server: ${selectedServer?.name}`);
    setShowInstallDialog(false);
  };

  const filteredServers = servers.filter(server => {
    const matchesSearch = searchQuery === "" || 
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "All" || 
      (selectedCategory === "Weather" && server.name.toLowerCase().includes("weather")) ||
      (selectedCategory === "Finance" && server.name.toLowerCase().includes("finance")) ||
      (selectedCategory === "Productivity" && server.name.toLowerCase().includes("calculator")) ||
      (selectedCategory === "Development" && server.name.toLowerCase().includes("development")) ||
      (selectedCategory === "Health" && server.name.toLowerCase().includes("health"));
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {categories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Popular Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm">API</Button>
                <Button variant="outline" size="sm">Data</Button>
                <Button variant="outline" size="sm">Tools</Button>
                <Button variant="outline" size="sm">Utilities</Button>
                <Button variant="outline" size="sm">Search</Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Main content */}
        <div className="flex-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>MCP Server Marketplace</CardTitle>
              <CardDescription>
                Discover and install pre-built MCP servers to enhance your AI assistants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Input
                  placeholder="Search servers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
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
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
            </CardContent>
          </Card>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <p className="mt-4 text-muted-foreground">Loading servers...</p>
            </div>
          ) : filteredServers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No servers found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServers.map((server) => (
                <Card key={server.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle>{server.name}</CardTitle>
                    <CardDescription>{server.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium">Tools:</span> {server.tools.length}
                      </div>
                      <div className="mt-4 space-y-2">
                        {server.tools.map((tool) => (
                          <div key={tool.id} className="text-sm border-l-2 border-primary/50 pl-2">
                            {tool.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full"
                      onClick={() => handleInstall(server)}
                    >
                      Install Server
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install MCP Server</DialogTitle>
            <DialogDescription>
              Add this server to your MCP Client to use its tools
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedServer && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">{selectedServer.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedServer.description}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-2">Tools Included:</h4>
                  <ul className="space-y-2">
                    {selectedServer.tools.map(tool => (
                      <li key={tool.id} className="text-sm">
                        <span className="font-medium">{tool.name}</span>
                        <p className="text-muted-foreground">{tool.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border rounded-lg p-4 font-mono text-sm">
                  <div className="mb-2 text-muted-foreground">Configuration:</div>
                  <pre className="text-xs overflow-auto p-2 bg-muted rounded">
{`{
  "mcpServers": {
    "${selectedServer.name.toLowerCase().replace(/\s+/g, '-')}": {
      "url": "https://agent.mcpify.ai/sse?server=${selectedServer.id}",
      "name": "${selectedServer.name}"
    }
  }
}`}
                  </pre>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInstallDialog(false)}>Cancel</Button>
            <Button onClick={confirmInstall}>Install</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
