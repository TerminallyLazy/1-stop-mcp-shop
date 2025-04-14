"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { MCPTool } from "../../lib/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/collapsible";

interface ToolsPanelProps {
  tools: MCPTool[];
  envVars: { name: string; value: string; required: boolean }[];
  buildProgress: number;
  onEnvVarChange: (index: number, value: string) => void;
  onComplete: () => void;
}

export function ToolsPanel({ 
  tools, 
  envVars, 
  buildProgress, 
  onEnvVarChange, 
  onComplete 
}: ToolsPanelProps) {
  return (
    <div className="w-full h-full space-y-6 overflow-auto">
      {/* MCP Evolution Title */}
      <div className="mb-2">
        <h2 className="text-2xl font-bold">MCP Evolution</h2>
        <p className="text-muted-foreground mt-1">Build and customize your MCP Server</p>
      </div>
      
      {/* Build Progress */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Build Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Building server...</span>
              <span>{Math.round(buildProgress)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-300" 
                style={{ width: `${buildProgress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              {buildProgress < 30 ? (
                'Generating tools...'
              ) : buildProgress < 60 ? (
                'Setting up server endpoints...'
              ) : buildProgress < 90 ? (
                'Finalizing configuration...'
              ) : (
                'Almost ready, configure environment variables...'
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Generated Tools */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Generated Tools</CardTitle>
            <span className="text-xs bg-primary/10 text-primary py-1 px-2 rounded-full">
              {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
            </span>
          </div>
          <CardDescription>
            Your MCP Server will include these tools
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[300px] overflow-y-auto">
          <div className="space-y-4">
            {tools.map((tool) => (
              <Collapsible key={tool.id} className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-t-lg">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-4 pt-0 border-t">
                    <div className="mt-2">
                      <h4 className="text-sm font-medium mb-2">Parameters:</h4>
                      <ul className="space-y-2">
                        {tool.parameters.map((param) => (
                          <li key={param.name} className="text-sm bg-muted/50 p-2 rounded">
                            <div className="flex items-center justify-between">
                              <div className="font-mono">{param.name}</div>
                              <div className="flex items-center gap-1">
                                <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded">
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
                        View Code
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Environment Variables */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Environment Variables</CardTitle>
          <CardDescription>
            Configure your server's environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {envVars.length === 0 ? (
              <p className="text-sm text-muted-foreground">No environment variables needed</p>
            ) : (
              envVars.map((envVar, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center">
                    <label htmlFor={`env-${index}`} className="text-sm font-medium">
                      {envVar.name}
                      {envVar.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  </div>
                  <Input
                    id={`env-${index}`}
                    value={envVar.value}
                    onChange={(e) => onEnvVarChange(index, e.target.value)}
                    placeholder={`Enter ${envVar.name}...`}
                    className={envVar.required && !envVar.value ? "border-red-300" : ""}
                  />
                </div>
              ))
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            disabled={buildProgress < 90 || envVars.some(v => v.required && !v.value.trim())}
            onClick={onComplete}
          >
            {buildProgress >= 100 ? "Deploy MCP" : "Complete Configuration"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}