"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/lib/types";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onInitialSubmit: (query: string) => void;
  isGenerating: boolean;
  initialMode: boolean;
}

export function ChatInterface({ 
  messages, 
  onSendMessage, 
  onInitialSubmit, 
  isGenerating, 
  initialMode 
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    if (initialMode) {
      onInitialSubmit(input);
    } else {
      onSendMessage(input);
    }
    
    setInput('');
  };
  
  return (
    <div className="flex flex-col h-full bg-card rounded-md border">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-lg">MCPify.ai</h2>
        <div className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full px-2 py-1 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
          <span>Gemini</span>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {initialMode && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md p-6 bg-muted/50 rounded-lg">
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
                className="h-10 w-10 mx-auto mb-4 text-muted-foreground"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <h3 className="font-semibold text-lg mb-2">Build Your MCP Server</h3>
              <p className="text-muted-foreground text-sm">
                Describe what capabilities you want for your MCP Server, and I'll generate the tools
                and implementation for you.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
            >
              <div 
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'assistant' 
                    ? 'bg-muted text-left mr-auto' 
                    : 'bg-primary text-primary-foreground text-right ml-auto'
                }`}
              >
                <div className="whitespace-pre-wrap break-words text-sm">
                  {message.content}
                </div>
              </div>
            </div>
          ))
        )}
        
        {isGenerating && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
              <div className="flex space-x-2 items-center text-sm">
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t mt-auto">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Textarea
            placeholder={initialMode 
              ? "Describe the MCP Server you want to build..." 
              : "Ask about your MCP server tools..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            className="min-h-10 flex-grow resize-none"
            disabled={isGenerating}
          />
          <Button 
            type="submit"
            variant={initialMode ? "default" : "default"}
            className={initialMode ? "bg-green-600 hover:bg-green-700" : ""}
            disabled={!input.trim() || isGenerating}
          >
            {initialMode ? (
              "Generate my AI Tools"
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}