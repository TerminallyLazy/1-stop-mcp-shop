"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { MCPTool } from "../../lib/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/collapsible";

interface ToolsPanelProps {
  tools: MCPTool[];
  serverName?: string;
  serverDescription?: string;
  onDeploy?: () => void;
}

export function MCP_ToolsPanel({ tools, serverName, serverDescription, onDeploy }: ToolsPanelProps) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  
  const toggleTool = (toolId: string) => {
    setExpandedTools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
  };
  
  return (
    <div className="w-full h-full space-y-4 overflow-auto p-4">
      {/* MCP Evolution Title */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold">MCP Evolution</h2>
      </div>
      
      {/* Core Section */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 7h.01" />
              <path d="m7 17 10-10" />
              <path d="M17 17h.01" />
            </svg>
            <CardTitle className="text-lg">Core</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium">Title:</div>
              <div>{serverName || "FHIR Medical Records MCP Server"}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Vision:</div>
              <div className="text-sm text-muted-foreground">
                {serverDescription || "An MCP server that connects to FHIR servers (HAPI, Epic, Cerner, etc.) to retrieve patient medical records and provides tools for medical research."}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tools Section */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
              <path d="m14.7 6.3-1 1 2 2 1-1-2-2Z" />
              <path d="m11.7 9.3-9 9L2 22l3.7-.7 9-9-4-4Z" />
              <path d="m16 6-2-2" />
              <path d="M17 2h-1a4 4 0 0 0-4 4v.28A2 2 0 0 0 10.28 8H10a4 4 0 0 0-4 4v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2" />
              <path d="m18 16 2-2" />
              <path d="m17 12 5-5" />
            </svg>
            <CardTitle className="text-lg">Tools</CardTitle>
          </div>
          <CardDescription>
            {tools.length > 0 
              ? `${tools.length} ${tools.length === 1 ? 'tool' : 'tools'} available`
              : 'No tools generated yet'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[350px] overflow-y-auto">
          {tools.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-muted-foreground/50 h-12 w-12">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <p>Tools will appear here after generation</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tools.map((tool) => (
                <Collapsible 
                  key={tool.id || tool.name} 
                  className="border rounded-lg overflow-hidden"
                  open={expandedTools.has(tool.id || tool.name)}
                  onOpenChange={() => toggleTool(tool.id || tool.name)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-t-lg">
                      <div className="flex items-center gap-2">
                        <div className="bg-green-100 text-green-700 p-2 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-medium">{tool.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">{tool.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-muted px-2 py-1 rounded-full">
                          {tool.parameters.length} params
                        </span>
                        <Button variant="outline" size="sm" className="ml-2 p-1 h-7 w-7">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 border-t">
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Parameters:</h4>
                        <ul className="space-y-2">
                          {tool.parameters.map((param: { name: string; type: string; required: boolean; description: string; }) => (
                            <li key={String(param.name)} className="text-sm bg-muted/50 p-2 rounded">
                              <div className="flex items-center justify-between">
                                <div className="font-mono">{param.name}</div>
                                <div className="flex items-center gap-1">
                                  <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded">
                                    {param.type}
                                  </span>
                                  {param.required && (
                                    <span className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs px-1.5 py-0.5 rounded">
                                      required
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-muted-foreground text-xs mt-1">
                                {param.description}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button variant="outline" size="sm" className="text-xs">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                          </svg>
                          Code
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
        {tools.length > 0 && (
          <CardFooter>
            <Button 
              className="w-full bg-green-600 hover:bg-green-700" 
              onClick={onDeploy}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M12 5v14" />
                <path d="m19 12-7 7-7-7" />
              </svg>
              Deploy MCP
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}