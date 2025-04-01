"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MCPTool, ChatMessage } from "@/lib/types";

// Define the callback type
type ToolsGeneratedCallback = (tools: MCPTool[], description: string) => void;

// Define the props type
interface SplitViewBuilderProps {
  onToolsGenerated?: ToolsGeneratedCallback;
}

export function SplitViewBuilder({ onToolsGenerated }: SplitViewBuilderProps) {
  // State for query input and generation
  const [initialQuery, setInitialQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitialQuerySubmitted, setIsInitialQuerySubmitted] = useState(false);
  
  // State for chat messages and tools
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [generatedTools, setGeneratedTools] = useState<MCPTool[]>([]);
  const [envVars, setEnvVars] = useState<{name: string, value: string, required: boolean}[]>([]);
  
  // State for build progress
  const [buildProgress, setBuildProgress] = useState(0);
  
  // For auto-scrolling chat
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle initial query submission
  const handleInitialSubmit = async () => {
    if (!initialQuery.trim()) return;
    
    setIsGenerating(true);
    
    try {
      // Start progress animation
      simulateProgress(0, 40);
      
      // Create initial user message
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'user',
        content: initialQuery,
        createdAt: new Date().toISOString()
      };
      
      setChatMessages([userMessage]);
      
      // Import the generateMCPTools function
      const { generateMCPTools, createDefaultTools } = await import('@/lib/api/mcp');
      
      // Try to generate tools, fallback to default if needed
      let tools;
      try {
        console.log('Generating tools with API...');
        tools = await generateMCPTools(initialQuery, "gemini-2.5-pro-exp-03-25");
      } catch (apiError) {
        console.error('Error with API call, using default tools:', apiError);
        tools = createDefaultTools(initialQuery);
      }
      
      setGeneratedTools(tools);
      
      // Now generate an assistant response
      const { callGeminiAPI } = await import('@/lib/api/gemini');
      
      // Create system prompt for Gemini
      const systemPrompt = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers based on user requirements. The user has requested an MCP server with the following description: "${initialQuery}".
        
I've already generated these tools:
${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Your task is to:
1. Refine these tools by asking clarifying questions
2. Help identify any required API keys or environment variables
3. Suggest improvements or additional tools the user might need
4. Guide the user through configuring and building their MCP server

Be conversational but efficient, focusing on practical development details.`;

      // Prepare welcome message
      const welcomeMessage = `I'll help you build a complete MCP server based on your requirements. I've analyzed your description and created these initial tools shown on the right panel.

Let's refine this further:

1. For each tool, do you need any specific features or parameters beyond what's shown?
2. Will you need authentication for any of these tools (API keys, tokens, etc.)?
3. Are there any additional tools you'd like to add?

I'll help customize these tools and prepare everything for deployment. Feel free to ask questions or request changes at any point.`;

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: welcomeMessage,
        createdAt: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Create initial environment variables based on tools
      const suggestedVars = extractPotentialEnvVars(tools, initialQuery);
      setEnvVars(suggestedVars);
      
      // Set initial query as submitted
      setIsInitialQuerySubmitted(true);
      
      // Continue progress animation
      simulateProgress(40, 60);
      
      // Call the callback function if provided
      if (onToolsGenerated) {
        (onToolsGenerated as (tools: MCPTool[], desc: string) => void)(tools, initialQuery);
      }
    } catch (error) {
      console.error("Error generating tools:", error);
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: "I encountered an error while generating tools. Let's try again or please provide more details about what you're looking to build.",
        createdAt: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle ongoing chat messages
  const handleChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content: chatInput,
      createdAt: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsGenerating(true);
    
    try {
      // Create context from the current tools and env vars
      const toolsContext = generatedTools.map(tool => 
        `Tool: ${tool.name}\nDescription: ${tool.description}\nParameters: ${tool.parameters.map(p => 
          `${p.name} (${p.type})${p.required ? ' [required]' : ''}`).join(', ')}`
      ).join('\n\n');
      
      const envVarsContext = envVars.length > 0 
        ? `Current environment variables:\n${envVars.map(v => `${v.name}${v.required ? ' [required]' : ''}`).join('\n')}`
        : 'No environment variables configured yet.';
      
      // Create system prompt with context
      const systemPrompt = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers based on user requirements. 
        
The user has requested an MCP server with the following description: "${initialQuery}".

Current tools:
${toolsContext}

${envVarsContext}

Build progress: ${Math.round(buildProgress)}%

Respond conversationally to the user, helping them refine their MCP server. Focus on practical details. Suggest improvements, and help identify missing environment variables or configuration needed. Keep responses under 150 words.`;
      
      // Format messages for API
      const formattedMessages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...chatMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];
      
      // Call the Gemini API
      const { callGeminiAPI } = await import('@/lib/api/gemini');
      const response = await callGeminiAPI({
        model: 'gemini-2.5-pro-exp-03-25',
        messages: formattedMessages,
      });
      
      const responseContent = response?.content || "I'm sorry, I couldn't generate a response. Let's continue building your MCP server.";
      
      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: responseContent,
        createdAt: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Update progress - increment slightly for each interaction
      setBuildProgress(prev => Math.min(prev + 5, 95));
      
      // Check for new environment variables in the response
      const newEnvVars = extractEnvVarsFromResponse(responseContent);
      if (newEnvVars.length > 0) {
        setEnvVars(prev => {
          // Merge with existing vars, avoiding duplicates
          const existing = new Set(prev.map(v => v.name));
          const combined = [...prev];
          for (const newVar of newEnvVars) {
            if (!existing.has(newVar.name)) {
              combined.push(newVar);
            }
          }
          return combined;
        });
      }
    } catch (error) {
      console.error("Error in chat:", error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: "I'm having trouble processing your request. Let's continue with the MCP server configuration. Could you tell me more about what you're trying to build?",
        createdAt: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Simulate progress animation
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
  
  // Extract potential environment variables from tools and description
  const extractPotentialEnvVars = (tools: MCPTool[], description: string): {name: string, value: string, required: boolean}[] => {
    const envVars: {name: string, value: string, required: boolean}[] = [];
    
    // Look for potential API keys based on tool names and descriptions
    const lowerDesc = description.toLowerCase();
    const toolDescriptions = tools.map(t => t.description.toLowerCase()).join(' ');
    const toolNames = tools.map(t => t.name.toLowerCase()).join(' ');
    const combinedText = `${lowerDesc} ${toolDescriptions} ${toolNames}`;
    
    // API key detection patterns based on tool and description content
    const servicePatterns = [
      { 
        service: 'WEATHER',
        keywords: ['weather', 'forecast', 'temperature', 'climate', 'meteo', 'precipitation', 'humidity'],
        tools: ['get_weather', 'weather', 'forecast']
      },
      { 
        service: 'FINANCE', 
        keywords: ['stock', 'finance', 'market', 'price', 'ticker', 'exchange rate', 'currency'],
        tools: ['get_stock', 'finance', 'stock_data', 'market']
      },
      { 
        service: 'SEARCH', 
        keywords: ['search', 'find', 'lookup', 'query', 'google', 'bing'],
        tools: ['search', 'web_search', 'lookup', 'find']
      },
      { 
        service: 'MAPS', 
        keywords: ['map', 'location', 'geocode', 'distance', 'route', 'navigation', 'directions'],
        tools: ['get_location', 'calculate_route', 'geocode', 'distance']
      },
      { 
        service: 'TRANSLATION', 
        keywords: ['translate', 'language', 'localization'],
        tools: ['translate', 'language_detection', 'translation']
      },
      { 
        service: 'DATABASE', 
        keywords: ['database', 'sql', 'query', 'storage'],
        tools: ['query_database', 'database', 'db_operation', 'sql']
      },
      { 
        service: 'OPENAI',
        keywords: ['openai', 'gpt', 'chatgpt', 'completion', 'dalle'],
        tools: ['generate_text', 'generate_image', 'chat', 'embedding']
      }
    ];
    
    // Check each service pattern against the tools and description
    for (const pattern of servicePatterns) {
      const keywordMatch = pattern.keywords.some(k => combinedText.includes(k));
      const toolMatch = pattern.tools.some(t => 
        tools.some(tool => tool.name.toLowerCase().includes(t))
      );
      
      if (keywordMatch || toolMatch) {
        envVars.push({
          name: `${pattern.service}_API_KEY`, 
          value: '', 
          required: true
        });
      }
    }
    
    // Detect API base URLs when appropriate
    if (envVars.some(v => v.name.includes('API_KEY'))) {
      // If we have API keys, we likely need base URLs
      // Check if any tool looks like it calls an external API
      const needsBaseUrl = tools.some(t => 
        t.description.toLowerCase().includes('api') || 
        t.parameters.some(p => p.name.includes('url') || p.description.includes('endpoint'))
      );
      
      if (needsBaseUrl) {
        // For each detected API, add a base URL
        for (const env of [...envVars]) {
          if (env.name.includes('API_KEY') && !envVars.some(v => v.name === `${env.name.replace('_KEY', '_URL')}`)) {
            envVars.push({
              name: `${env.name.replace('_KEY', '_URL')}`,
              value: '', 
              required: true
            });
          }
        }
      }
    }
    
    // Always add MCP server URL - this is for client configuration
    envVars.push({
      name: 'MCP_SERVER_URL', 
      value: `${window.location.origin}/api/mcp/`, 
      required: false
    });
    
    // Add PORT for server deployment
    envVars.push({
      name: 'PORT',
      value: '3000',
      required: false
    });
    
    return envVars;
  };
  
  // Extract environment variables mentioned in LLM responses
  const extractEnvVarsFromResponse = (response: string): {name: string, value: string, required: boolean}[] => {
    const envVars: {name: string, value: string, required: boolean}[] = [];
    
    // Patterns for environment variables in different formats
    const patterns = [
      // Standard environment variable names in all caps
      /\b([A-Z][A-Z0-9_]+(?:API|TOKEN|KEY|SECRET|PASSWORD|ENDPOINT|URL|URI|HOST|CONFIG|ENV|ID|PATH)[A-Z0-9_]*)\b/g,
      
      // Common env var patterns in code contexts like process.env.XXX
      /process\.env\.([A-Z][A-Z0-9_]+)/g,
      /env\.([A-Z][A-Z0-9_]+)/g,
      /ENV\.([A-Z][A-Z0-9_]+)/g,
      
      // Vars mentioned in specific formats
      /environment variable[^.!?]+"?([A-Z][A-Z0-9_]+)"?/gi,
      /need to set[^.!?]+"?([A-Z][A-Z0-9_]+)"?/gi,
      /required[^.!?]+"?([A-Z][A-Z0-9_]+)"?/gi,
      /api key[^.!?]+"?([A-Z][A-Z0-9_]+)"?/gi
    ];
    
    // Run all patterns and collect results
    const allMatches: string[] = [];
    
    for (const pattern of patterns) {
      const matches = Array.from(response.matchAll(pattern) || []);
      for (const match of matches) {
        if (match[1]) {
          allMatches.push(match[1].toUpperCase()); // Normalize to uppercase
        }
      }
    }
    
    // Deduplicate
    const uniqueKeys = [...new Set(allMatches)];
    
    // Check for requirements context
    for (const key of uniqueKeys) {
      // Skip common false positives like "THIS_IS" or short vars
      if (key.length < 4 || /^(THIS_IS|IT_IS|THAT_IS)/.test(key)) {
        continue;
      }
      
      // Look for words indicating requirement
      const keyIndex = response.indexOf(key);
      if (keyIndex === -1) continue; // Skip if not found
      
      // Get context around the key (100 chars before and after)
      const startContext = Math.max(0, keyIndex - 100);
      const endContext = Math.min(response.length, keyIndex + key.length + 100);
      const context = response.substring(startContext, endContext).toLowerCase();
      
      // Check if this seems like a required variable
      const isRequired = 
        context.includes('required') || 
        context.includes('need') || 
        context.includes('necessary') || 
        context.includes('must') ||
        !context.includes('optional');
        
      // Add to env vars
      envVars.push({
        name: key,
        value: '',
        required: isRequired
      });
    }
    
    return envVars;
  };
  
  const handleEnvVarChange = (index: number, value: string) => {
    setEnvVars(prev => {
      const updated = [...prev];
      updated[index] = {...updated[index], value};
      return updated;
    });
    
    // Update progress when env vars are filled in
    if (value.trim() !== '') {
      setBuildProgress(prev => Math.min(prev + 1, 99));
    }
  };

  return (
    <div className="w-full">
      {!isInitialQuerySubmitted ? (
        // Initial view (pre-generate)
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Create Your MCP Server</CardTitle>
            <CardDescription>
              Tell us what capabilities you want your AI to have, and we'll create the implementation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="I want to create a weather tool that can show current weather and forecasts for any city in the world"
              className="min-h-32 mb-4 w-full"
              value={initialQuery}
              onChange={(e) => setInitialQuery(e.target.value)}
            />
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              onClick={handleInitialSubmit}
              disabled={isGenerating || !initialQuery.trim()}
            >
              {isGenerating ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generating...</span>
                </div>
              ) : "Generate My AI Tools"}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        // Split view interface - will be shown in a grid layout by the parent component
        <div className="w-full h-full flex flex-col">
          {/* Chat Interface */}
          <div className="flex-grow overflow-hidden flex flex-col h-full bg-card rounded-md border">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-lg">AI Assistant</h2>
              <div className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full px-2 py-1 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                </svg>
                <span>Gemini 2.5 Pro</span>
              </div>
            </div>
            
            {/* Chat Messages */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {chatMessages.map((message, index) => (
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
              ))}
              
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
              
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat Input */}
            <div className="p-4 border-t mt-auto">
              <div className="flex space-x-2">
                <Textarea
                  placeholder="Ask about your MCP server tools..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatMessage();
                    }
                  }}
                  className="min-h-10 flex-grow"
                  disabled={isGenerating}
                />
                <Button 
                  onClick={handleChatMessage}
                  disabled={!chatInput.trim() || isGenerating}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}