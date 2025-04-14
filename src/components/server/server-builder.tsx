"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { MCPTool, ChatMessage } from "../../lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { useChat } from "../../lib/hooks/use-chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DeploymentModal } from "../deployment-modal";

interface Message {
  role: 'user' | 'ai';
  content: string;
}

// Define the callback type explicitly
interface ServerBuilderProps {
  onToolsGenerated?: (tools: MCPTool[], description: string) => void;
}

type SupportedModel = 'claude-3-7-sonnet-20250219' | 'gemini-2.5-pro-exp-03-25' | 'gemini-2.0-flash';

export function ServerBuilder({ onToolsGenerated }: ServerBuilderProps) {
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTools, setGeneratedTools] = useState<MCPTool[]>([]);
  const [selectedModel, setSelectedModel] = useState<SupportedModel>('gemini-2.5-pro-exp-03-25');
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [userInput, setUserInput] = useState("");
  const [serverResponse, setServerResponse] = useState<string | null>(null);
  const [generatedServerCode, setGeneratedServerCode] = useState<string | null>(null);
  const [buildProgress, setBuildProgress] = useState(0);
  const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState(false);

  // For scrolling in the right panel
  const rightPanelMessagesRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, isLoading } = useChat({
    onResponse: async (response) => {
      // We don't need automatic tool generation on response anymore
      // as we're changing the workflow to show responses in right panel
    }
  });

  const exampleCategories = [
    { id: "all", name: "All Templates" },
    { id: "data", name: "Data Retrieval" },
    { id: "utilities", name: "Utilities" },
    { id: "apis", name: "External APIs" }
  ];

  const examples = [
    {
      id: "calculator",
      name: "Smart Calculator",
      description: "Math operations and unit conversions",
      category: "utilities",
      icon: "calculator"
    },
    {
      id: "weather",
      name: "Weather API Hub",
      description: "Current weather and forecasts for any city",
      category: "apis",
      icon: "weather"
    },
    {
      id: "finance",
      name: "Finance Toolkit",
      description: "Stock prices, exchange rates, market data",
      category: "apis",
      icon: "finance"
    },
    {
      id: "search",
      name: "Web Search",
      description: "Find information on the internet",
      category: "data",
      icon: "search"
    },
    {
      id: "database",
      name: "Database Query",
      description: "Query and return structured data",
      category: "data",
      icon: "database"
    },
    {
      id: "translator",
      name: "Language Translator",
      description: "Translate between multiple languages",
      category: "utilities",
      icon: "translator"
    }
  ];

  const filteredExamples = selectedCategory === "all"
    ? examples
    : examples.filter(example => example.category === selectedCategory);

  const handleExampleClick = (example: typeof examples[0]) => {
    setDescription(example.description);
  };

  // Simulate progress animation for better UX
  const simulateProgress = (
    startValue: number = 0,
    endValue: number = 90,
    intervalSpeed: number = 100
  ) => {
    // Set initial value if provided
    if (startValue > 0) {
      setBuildProgress(startValue);
    }

    // Clear any existing intervals to prevent multiple running simultaneously
    const intervalId = window.setInterval(() => {
      setBuildProgress(prev => {
        // Calculate increment based on how far we are from end value
        // Slowdown as we approach end value
        const remaining = endValue - prev;
        const increment = Math.max(0.2, remaining * 0.1) * (Math.random() * 0.5 + 0.5);

        if (prev >= endValue) {
          window.clearInterval(intervalId);
          return endValue; // Stop at endValue
        }
        return Math.min(prev + increment, endValue);
      });
    }, intervalSpeed);

    // Store the interval ID for clearing later if needed
    return intervalId;
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;

    setIsGenerating(true);
    setServerResponse(null);
    setGeneratedServerCode(null);
    setGeneratedTools([]);
    setBuildProgress(0);

    try {
      // Start progress animation
      simulateProgress(0, 25); // Phase 1: Initial analysis

      // === Step 1: Get initial analysis from LLM ===
      const initialSystemPrompt = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers.
The user has requested an MCP server for: "${description}".

Your task is to analyze this request and suggest appropriate tools that this MCP server should implement.
For each tool, provide:
1. A name in snake_case format
2. A detailed description of what the tool does
3. Required parameters with names, types, and descriptions

Format your response as a conversational analysis of what's needed, focusing on how the tools would work together.
Be thorough but concise. Don't include any code yet.`;

      const initialMessage = [
        {
          role: 'system',
          content: initialSystemPrompt,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString()
        },
        {
          role: 'user',
          content: description,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString()
        }
      ];

      // Direct API call instead of using dynamic import
      const initialResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: initialMessage,
          model: selectedModel
        })
      });

      if (!initialResponse.ok) {
        throw new Error(`API call failed: ${initialResponse.status} ${initialResponse.statusText}`);
      }

      const initialData = await initialResponse.json();

      if (!initialData?.success && initialData?.error) {
        throw new Error(`API error: ${initialData.error}`);
      }

      if (!initialData?.message?.content) {
        throw new Error("Failed to get initial response from LLM");
      }

      // Store the server response to display in the right panel
      setServerResponse(initialData.message.content);
      simulateProgress(25, 40); // Phase 2: Generate tools

      // === Step 2: Second LLM call to generate tools structure ===
      const secondSystemPrompt = `You are an AI engineering assistant specialized in generating MCP (Model Context Protocol) tools.
The user has requested an MCP server for: "${description}".

An initial analysis has been provided:
${initialData.message.content}

Your task is to convert this analysis into structured JSON tool definitions following the MCP specification.
Each tool needs:
1. A name in snake_case format
2. A description explaining what the tool does
3. Parameters with:
   - name (camelCase)
   - type (string, number, boolean, object, array)
   - description
   - required (boolean)
   - enum (optional array of allowed values)
   - default (optional default value)

Return ONLY a JSON array of tools without any explanation or markdown. The array should contain objects in this format:
[
  {
    "name": "tool_name",
    "description": "Clear description of what the tool does",
    "parameters": [
      {
        "name": "paramName",
        "type": "string|number|boolean|object|array",
        "description": "What this parameter is used for",
        "required": true/false,
        "enum": ["option1", "option2"],
        "default": "default_value"
      }
    ]
  }
]`;

      const secondMessage = [
        {
          role: 'system',
          content: secondSystemPrompt,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString()
        },
        {
          role: 'user',
          content: description,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString()
        },
        {
          role: 'assistant',
          content: initialData.message.content,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString()
        }
      ];

      // Second LLM call - generate tool structure
      const toolsResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: secondMessage,
          model: selectedModel
        })
      });

      if (!toolsResponse.ok) {
        throw new Error(`API call failed: ${toolsResponse.status} ${toolsResponse.statusText}`);
      }

      const toolsData = await toolsResponse.json();

      if (!toolsData?.success && toolsData?.error) {
        throw new Error(`API error: ${toolsData.error}`);
      }

      if (!toolsData?.message?.content) {
        throw new Error("Failed to get tools structure from LLM");
      }

      // Parse JSON tools from response
      let tools: MCPTool[] = [];
      try {
        const toolsContent = toolsData.message.content;
        const jsonMatch = toolsContent.match(/\[\s*\{[\s\S]*\}\s*\]/);

        if (jsonMatch) {
          const parsedTools = JSON.parse(jsonMatch[0]);

          if (Array.isArray(parsedTools) && parsedTools.length > 0) {
            // Process and format the tools
            const now = new Date().toISOString();
            tools = parsedTools.map((tool: any) => ({
              id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              name: tool.name || `tool_${Math.random().toString(36).substring(2, 7)}`,
              description: tool.description || 'A generated tool for this MCP server',
              parameters: Array.isArray(tool.parameters) ? tool.parameters.map((param: any) => ({
                name: param.name || 'param',
                type: ['string', 'number', 'boolean', 'object', 'array'].includes(param.type) ? param.type : 'string',
                description: param.description || `Parameter for ${param.name || 'this tool'}`,
                required: param.required === true,
                enum: Array.isArray(param.enum) ? param.enum : undefined,
                default: param.default
              })) : [],
              serverId: '',
              createdAt: now,
              updatedAt: now
            }));
          }
        }
      } catch (parseError) {
        console.error("Error parsing tools JSON:", parseError);
        throw new Error("Failed to parse tools from LLM response");
      }

      if (tools.length === 0) {
        throw new Error("No valid tools generated from LLM response");
      }

      setGeneratedTools(tools);
      simulateProgress(40, 60); // Phase 3: Generate server code

      // === Step 3: Generate Server Code ===
      try {
        console.log('Generating MCP server code...');
        // Call the API directly rather than importing
        const serverCodeResponse = await fetch('/api/mcp/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description,
            tools,
            model: selectedModel
          })
        });

        if (!serverCodeResponse.ok) {
          throw new Error(`API call failed: ${serverCodeResponse.status} ${serverCodeResponse.statusText}`);
        }

        const serverCodeData = await serverCodeResponse.json();
        setGeneratedServerCode(serverCodeData.code);
        simulateProgress(60, 85); // Phase 4: Finish up
      } catch (serverGenError) {
        console.error('Error generating server code:', serverGenError);
        throw new Error("Failed to generate server code: " + serverGenError);
      }

      // === Step 4: Generate final summary message ===
      const finalSystemPrompt = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers.
The user has requested an MCP server for: "${description}".

I've analyzed the request and generated these tools to implement:
${JSON.stringify(tools, null, 2)}

I've also generated the full TypeScript server code implementing these tools.

Your task is to provide a detailed explanation for the user about:

1. Summary of the MCP Server that was built
2. Detailed explanation of each tool created and its functionality
3. Notes on how to use these tools
4. Any API keys or configuration that might be needed
5. How the tools work together to meet the user's requirements

Be comprehensive but well-structured with clear headers for each section. This should be a self-contained explanation that gives the user everything they need to know about their new MCP Server.`;

      const finalMessage = [
        {
          role: 'system',
          content: finalSystemPrompt,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString()
        },
        {
          role: 'user',
          content: description,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString()
        }
      ];

      // Final LLM call - comprehensive summary
      const finalResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: finalMessage,
          model: selectedModel
        })
      });

      if (!finalResponse.ok) {
        throw new Error(`API call failed: ${finalResponse.status} ${finalResponse.statusText}`);
      }

      const finalData = await finalResponse.json();

      if (!finalData?.success && finalData?.error) {
        throw new Error(`API error: ${finalData.error}`);
      }

      if (!finalData?.message?.content) {
        throw new Error("Failed to generate final summary");
      }

      // Update the server response with the final comprehensive summary
      setServerResponse(finalData.message.content);

      // Complete the progress bar
      simulateProgress(85, 100);
      setBuildProgress(100);

      // Call the callback if provided to pass tools to parent component
      if (onToolsGenerated && tools.length > 0) {
        onToolsGenerated(tools, description);
      }
    } catch (error) {
      console.error("Error during MCP server generation:", error);

      // Show error in right panel
      setServerResponse(`## Error Building MCP Server

I encountered an error while building your MCP server:
${error instanceof Error ? error.message : String(error)}

Please try again with a more specific description or different requirements.`);

      // Reset progress bar
      setBuildProgress(0);
    } finally {
      setIsGenerating(false);
    }
  };

  // Icons mapping based on keywords in the description
  const getIconForExample = (id: string) => {
    switch (id) {
      case "calculator":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <rect width="16" height="20" x="4" y="2" rx="2" />
            <line x1="8" x2="16" y1="6" y2="6" />
            <line x1="8" x2="8" y1="14" y2="18" />
            <line x1="12" x2="12" y1="14" y2="18" />
            <line x1="16" x2="16" y1="14" y2="18" />
            <line x1="8" x2="16" y1="10" y2="10" />
          </svg>
        );
      case "weather":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 14.5a4.5 4.5 0 0 0 4 4.5h9.5Z" />
          </svg>
        );
      case "finance":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <line x1="12" x2="12" y1="2" y2="22" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        );
      case "search":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        );
      case "database":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        );
      case "translator":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <path d="m5 8 6 6" />
            <path d="m4 14 6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="m22 22-5-10-5 10" />
            <path d="M14 18h6" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        );
    }
  };

  const handleMessageSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    // Store the input for potential tool generation
    setDescription(userInput);

    // Send the message through the chat system
    await sendMessage(userInput);

    // Clear input field
    setUserInput('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-[calc(95vh-12rem)] max-w-[1900px] mx-auto w-full px-2">
      {/* Left Side - Chat Interface */}
      <div className="border rounded-lg flex flex-col overflow-hidden w-full lg:col-span-1">
        <div className="bg-primary/5 p-3 border-b flex justify-between items-center">
          <h3 className="font-medium">Chat with AI to Build Your MCP Server</h3>
          <select
            className="text-sm border rounded px-2 py-1 bg-background"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as SupportedModel)}
          >
            <option value="claude-3-7-sonnet-20250219">Claude 3 Sonnet</option>
            <option value="gemini-2.5-pro-exp-03-25">Gemini 2.5 Pro</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
          </select>
        </div>
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Describe what tools you want your MCP server to have.</p>
              <p className="text-sm mt-2">Example: "I need a weather API that can show current conditions and forecasts."</p>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-lg max-w-[80%] px-4 py-2 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Override components for styling
                          p: ({ children }) => <p className="mb-2">{children}</p>,
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
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}

              {/* Thinking animation */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-lg max-w-[80%] px-4 py-2 bg-muted">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }}></div>
                      </div>
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input area */}
        <form onSubmit={handleMessageSubmit} className="border-t p-3 flex gap-2">
          <Input
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Describe the tools you want..."
            className="flex-1"
            disabled={isLoading || isGenerating}
          />
          <Button type="submit" disabled={isLoading || !userInput.trim() || isGenerating}>
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            )}
          </Button>
        </form>
      </div>

      {/* Right Side - Tools Panel */}
      <div className="border rounded-lg flex flex-col overflow-hidden w-full">
        <div className="bg-primary/5 p-3 border-b flex justify-between items-center">
          <h3 className="font-medium">MCP Tools</h3>

          <div className="flex items-center gap-2">
            {/* Progress bar */}
            {isGenerating || buildProgress > 0 ? (
              <div className="w-24 bg-gray-200 rounded-full h-2.5 mr-2">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${buildProgress}%` }}
                ></div>
              </div>
            ) : null}

            {generatedTools.length > 0 && buildProgress === 100 && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    if (typeof onToolsGenerated === 'function') {
                      onToolsGenerated(generatedTools, description);
                    }
                  }}
                  className="text-xs"
                >
                  Save
                </Button>

                <Button
                  size="sm"
                  onClick={() => setIsDeploymentModalOpen(true)}
                  className="text-xs bg-green-600 hover:bg-green-700 text-white"
                >
                  Deploy
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tools and server response display area */}
        <div className="flex-1 overflow-y-auto p-3" ref={rightPanelMessagesRef}>
          {!serverResponse && !isGenerating && generatedTools.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Your MCP server details will appear here</p>
              <p className="text-sm mt-2">Click "Create MCP Server" to start</p>
            </div>
          ) : isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-pulse text-center">
                <div className="inline-block p-3 rounded-full bg-primary/10 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <circle cx="12" cy="12" r="4"/>
                  </svg>
                </div>
                <p>Building your MCP server...</p>
                <p className="text-xs text-muted-foreground">{Math.round(buildProgress)}% complete</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Server response */}
              {serverResponse && (
                <div className="mb-6">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2">{children}</p>,
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
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-2 border-b pb-1 mt-4">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-md font-bold mb-2 mt-3">{children}</h3>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-500 pl-2 py-1 my-2">{children}</blockquote>,
                    }}
                  >
                    {serverResponse}
                  </ReactMarkdown>
                </div>
              )}

              {/* Generated Tools Display */}
              {generatedTools.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-lg font-bold mb-4 border-b pb-2">Generated MCP Tools</h2>
                  <div className="space-y-4">
                    {generatedTools.map((tool) => (
                      <div key={tool.id} className="border rounded-lg shadow-sm">
                        <div className="flex items-center p-3 bg-blue-500/10 border-b">
                          <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-1.5 mr-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                              <path d="M14 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
                              <path d="M14 24v-5.5l2.5-2.5-7-7-2.5 2.5L1.5 6"/>
                              <path d="m8.5 8.5 7 7"/>
                              <path d="m15 8 7 7"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{tool.name}</h4>
                            <p className="text-sm text-muted-foreground">{tool.description}</p>
                          </div>
                          <div className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs py-1 px-2 rounded-full">
                            {tool.parameters.length} {tool.parameters.length === 1 ? 'parameter' : 'parameters'}
                          </div>
                        </div>
                        {tool.parameters.length > 0 && (
                          <div className="p-3 space-y-2">
                            <h5 className="text-sm font-medium">Parameters:</h5>
                            {tool.parameters.map((param) => (
                              <div key={param.name} className="flex flex-col bg-muted/30 p-2 rounded">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm font-mono bg-background px-1 py-0.5 rounded">{param.name}</code>
                                    <span className="text-xs text-primary border border-primary/20 bg-primary/5 px-1 rounded">{param.type}</span>
                                    {param.required && <span className="text-xs text-red-500">required</span>}
                                  </div>
                                  {param.enum && (
                                    <div className="text-xs text-muted-foreground">Options: {param.enum.join(', ')}</div>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{param.description}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generated Server Code Display */}
              {generatedServerCode && (
                <div className="mt-6">
                  <h2 className="text-lg font-bold mb-4 border-b pb-2">Generated MCP Server Implementation</h2>

                  {/* Check if the generatedServerCode starts with a markdown-style header */}
                  {generatedServerCode.startsWith('#') ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2">{children}</p>,
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
                        h2: ({ children }) => <h3 className="text-md font-bold mb-2 mt-6 bg-blue-500/10 p-2 rounded-t border-b">{children}</h3>,
                      }}
                    >
                      {generatedServerCode}
                    </ReactMarkdown>
                  ) : (
                    <div className="bg-gray-800 text-gray-200 p-4 rounded-md overflow-auto max-h-[500px]">
                      <pre className="text-sm font-mono whitespace-pre-wrap">{generatedServerCode}</pre>
                    </div>
                  )}

                  {/* Docker run command and deployment instructions */}
                  <div className="mt-6 p-4 bg-green-500/10 rounded-lg border border-green-200 dark:border-green-900">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                        <rect width="22" height="16" x="1" y="4" rx="2" ry="2" />
                        <path d="M1 10h22" />
                      </svg>
                      Quick Docker Deployment
                    </h3>
                    <p className="text-sm mb-3">Run these commands to deploy your MCP server with Docker:</p>

                    <div className="bg-gray-800 rounded p-3 text-gray-100 font-mono text-sm mb-3">
                      <div className="flex justify-between">
                        <code>docker-compose up -d</code>
                        <button
                          className="text-xs bg-gray-700 hover:bg-gray-600 px-2 rounded"
                          onClick={() => {
                            navigator.clipboard.writeText('docker-compose up -d');
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                      <span>Automatically builds and runs your server with all files and dependencies</span>
                    </div>

                    <Button
                      className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                      onClick={() => setIsDeploymentModalOpen(true)}
                    >
                      Deploy Automatically
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons for empty state */}
        {!isGenerating && !serverResponse && generatedTools.length === 0 && (
          <div className="border-t p-3">
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={isGenerating || !description.trim()}
            >
              {isGenerating ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Building Your MCP Server...</span>
                </div>
              ) : "Create MCP Server"}
            </Button>
          </div>
        )}
      </div>

      {/* Deployment Modal */}
      {generatedServerCode && (
        <DeploymentModal
          isOpen={isDeploymentModalOpen}
          onClose={() => setIsDeploymentModalOpen(false)}
          serverCode={generatedServerCode}
          serverName={description || "MCP Server"}
        />
      )}
    </div>
  );
}