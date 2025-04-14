"use client";

import { useState } from "react";
import { ToolCall } from "../../lib/types";

// This component displays the tool call arguments in a collapsible format
export function ToolResultDisplay({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Make sure the tool call has a valid tool name
  const toolName = toolCall?.tool || "Unknown Tool";
  
  // Safely extract and format the arguments
  const toolArgs = toolCall?.args || {};
  const formattedArgs = (() => {
    try {
      return JSON.stringify(toolArgs, null, 2);
    } catch (error) {
      console.error("Error formatting tool arguments:", error);
      return "Error formatting tool arguments";
    }
  })();
  
  return (
    <div className="text-sm w-full dark:bg-background/50">
      <div className="border rounded p-2 bg-muted/30">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="font-mono font-semibold text-yellow-700 dark:text-yellow-300"> Tool Call: {toolName}</span>
          <div className="flex items-center">
            {toolCall?.status && (
              <span className={`text-xs mr-2 px-1.5 py-0.5 rounded ${{
                'pending': 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
                'in_progress': 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
                'success': 'bg-green-500/20 text-green-700 dark:text-green-300',
                'error': 'bg-red-500/20 text-red-700 dark:text-red-300'
              }[toolCall.status] || 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                {toolCall.status === 'in_progress' ? 'running' : toolCall.status}
                
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {isExpanded ? '▲ Hide details' : '▼ Show details'}
            </span>
          </div>
        </div>
        
        {isExpanded && (
          <div className="pl-2 mt-2 pt-2 border-t">
            <div>
              <div className="text-xs font-medium mb-1">Tool Arguments:</div>
              <div className="bg-background/50 rounded border border-border/50 overflow-hidden">
                <div className="text-xs p-2 overflow-x-auto font-mono bg-muted/30">
                  <code className="whitespace-pre-wrap">{formattedArgs}</code>
                </div>
              </div>
            </div>
            
            {toolCall?.result && (
              <div className="mt-2">
                <div className="text-xs font-medium mb-1">Tool Result:</div>
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">
                  {typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
