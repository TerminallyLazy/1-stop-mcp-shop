"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/lib/types";
import { ToolResultDisplay } from "./tool-result-display";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "../ui/button";

interface ChatContainerProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function ChatContainer({ messages, isLoading }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  return (
    <div 
      className="space-y-4 chat-container overflow-y-auto" 
      style={{ maxHeight: 'calc(100vh - 250px)', minHeight: '300px' }}
    >
      {messages.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <p>Start a conversation with the AI</p>
          <div className="mt-4 space-y-2">
            <p className="text-sm">Try asking:</p>
            <div className="w-full space-y-2">
              <div className="rounded-lg border p-2 hover:bg-muted/50 cursor-pointer">
                What's the weather in Seattle?
              </div>
              <div className="rounded-lg border p-2 hover:bg-muted/50 cursor-pointer">
                What's the weather like today?
              </div>
              <div className="rounded-lg border p-2 hover:bg-muted/50 cursor-pointer">
                Calculate 42 * 18
              </div>
            </div>
          </div>
        </div>
      ) : (
        messages.map((message) => (
          <div 
            key={message.id} 
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : message.role === 'tool'
                    ? 'bg-blue-500/20 text-foreground border border-blue-500/50'
                    : message.role === 'system'
                      ? 'bg-green-500/20 text-foreground border border-green-500/50'
                      : 'bg-muted text-foreground'
              }`}
            >
              {message.role === 'tool' ? (
                <div>
                  <div className="text-xs flex items-center text-muted-foreground mb-1 w-full">Tool Result:</div>                  <div className="font-mono text-sm">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
                          View Tool Result
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[700px] rounded-lg">
                        <pre className="p-2 overflow-auto max-h-[400px] font-mono bg-muted/30">
                          <code>
                            {typeof message.content === 'string' ? message.content : 'Tool result received'}
                          </code>
                        </pre>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ) : message.toolCalls ? (
                <div className="w-full">
                  {/* Always show the initial LLM response text */}
                  {/* <div className="whitespace-pre-wrap">{message.content}</div> */}
                  
                  {/* Collapsible tool calls section */}
                  <div className="mt-2">
                    <div className="space-y-1">
                      {message.toolCalls.map(toolCall => (
                        <ToolResultDisplay key={toolCall.id} toolCall={toolCall} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{message.content}</div>
              )}
            </div>
          </div>
        ))
      )}
      {isLoading && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted text-foreground">
            <div className="flex space-x-2">
              <div className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce delay-75"></div>
              <div className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce delay-150"></div>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
