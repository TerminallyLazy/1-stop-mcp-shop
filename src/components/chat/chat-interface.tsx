"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { ChatMessage } from "../../lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  initialPrompt?: string;
  initialMode: boolean;
}

export function ChatInterface({ 
  messages, 
  onSendMessage,
  isLoading = false,
  initialPrompt,
  initialMode 
}: ChatInterfaceProps) {
  const [input, setInput] = useState(initialPrompt || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    onSendMessage(input);
    setInput('');
  };
  
  return (
    <div className="flex flex-col h-full bg-card rounded-md border">
      <div className="p-3 border-b flex items-center justify-between">
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
      
      <div className="flex-grow overflow-y-auto p-3 space-y-4">
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
                {message.role === 'user' ? (
                  <div className="whitespace-pre-wrap break-words text-sm">
                    {message.content}
                  </div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 text-sm">{children}</p>,
                      pre: ({ node, children, ...props }: any) => (
                        <pre className="bg-gray-800 text-gray-200 p-4 rounded-md my-4 overflow-x-auto text-sm" {...props}>
                          {children}
                        </pre>
                      ),
                      code: ({ node, inline, className, children, ...props }: any) => {
                        return inline ? (
                          <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-200 text-sm font-mono" {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className="block w-full text-gray-200 font-mono" {...props}>
                            {children}
                          </code>
                        )
                      },
                      a: ({ href, children }) => <a href={href} className="text-blue-500 hover:underline">{children}</a>,
                      ul: ({ children }) => <ul className="list-disc ml-5 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-5 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-md font-bold mb-2">{children}</h3>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-500 pl-2 py-1 my-2">{children}</blockquote>,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
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
      
      <div className="p-3 border-t mt-auto">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Textarea
            placeholder={initialMode 
              ? (initialPrompt || "Describe the MCP Server you want to build...") 
              : "Ask about your MCP server tools..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            className="min-h-10 flex-grow resize-none"
            disabled={isLoading}
          />
          <Button 
            type="submit"
            variant={initialMode ? "default" : "default"}
            className={initialMode ? "bg-green-600 hover:bg-green-700" : ""}
            disabled={!input.trim() || isLoading}
          >
            {initialMode ? (
              "Create MCP Server"
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