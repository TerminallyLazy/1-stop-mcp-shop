"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { MCPTool, ChatMessage } from "../../lib/types";

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
  
  // State for generated server code
  const [generatedServerCode, setGeneratedServerCode] = useState<string | null>(null);
  
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
    setGeneratedServerCode(null); // Reset server code on new generation
    setGeneratedTools([]); // Reset generated tools
    
    try {
      // Start progress animation
      simulateProgress(0, 15); // Phase 1: Initial analysis
      
      // Create initial user message
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'user',
        content: initialQuery,
        createdAt: new Date().toISOString()
      };
      
      setChatMessages([userMessage]);
      
      // === Step 1: Get initial analysis from LLM ===
      const { callGeminiAPI } = await import('../../lib/api/gemini');
      
      // Create system prompt for first LLM call
      const initialSystemPrompt = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers. 
The user has requested an MCP server for: "${initialQuery}".

Your task is to analyze this request and suggest appropriate tools that this MCP server should implement.
For each tool, provide:
1. A name in snake_case format
2. A detailed description of what the tool does
3. Required parameters with names, types, and descriptions

Format your response as a conversational analysis of what's needed, focusing on how the tools would work together.
Be thorough but concise. Don't include any code yet.`;

      const initialMessage: ChatMessage[] = [
        {
          role: 'system',
          content: initialSystemPrompt,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString()
        },
        userMessage
      ];
      
      // First LLM call - initial analysis
      simulateProgress(15, 30);
      const initialResponse = await callGeminiAPI(initialMessage);
      
      if (!initialResponse?.message?.content) {
        throw new Error("Failed to get initial response from LLM");
      }
      
      // Add assistant's initial analysis to chat
      const initialAssistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: initialResponse.message.content,
        createdAt: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, initialAssistantMessage]);
      
      // === Step 2: Second LLM call to generate tools structure ===
      simulateProgress(30, 50);
      
      const secondSystemPrompt = `You are an AI engineering assistant specialized in generating MCP (Model Context Protocol) tools.
The user has requested an MCP server for: "${initialQuery}".

An initial analysis has been provided:
${initialResponse.message.content}

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

Return ONLY a JSON array of tools in the exact format:
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

      const secondMessage: ChatMessage[] = [
        {
          role: 'system',
          content: secondSystemPrompt,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString()
        },
        userMessage,
        initialAssistantMessage
      ];
      
      // Second LLM call - generate tool structure
      const toolsResponse = await callGeminiAPI(secondMessage);
      
      if (!toolsResponse?.message?.content) {
        throw new Error("Failed to get tools structure from LLM");
      }
      
      // Parse JSON tools from response
      let tools: MCPTool[] = [];
      try {
        const toolsContent = toolsResponse.message.content;
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
        
        // Import fallback tools
        const { generateMCPTools, createDefaultTools } = await import('../../lib/api/mcp');
        tools = createDefaultTools(initialQuery);
      }
      
      setGeneratedTools(tools);
      
      // === Step 3: Generate Server Code ===
      simulateProgress(50, 70);
      
      try {
        console.log('Generating MCP server code...');
        const { generateMCPServerCode } = await import('../../lib/api/mcp');
        const serverCode = await generateMCPServerCode(initialQuery, tools);
        setGeneratedServerCode(serverCode);
      } catch (serverGenError) {
        console.error('Error generating server code:', serverGenError);
        const serverGenErrorMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role: 'assistant',
          content: "I was able to identify the tools needed, but encountered an error while generating the full server code. We can still refine the tools and environment variables.",
          createdAt: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, serverGenErrorMessage]);
      }
      
      // === Step 4: Generate Welcome Message ===
      simulateProgress(70, 90);
      
      // Create system prompt for welcome message
      const welcomeSystemPrompt = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers.
The user has requested an MCP server for: "${initialQuery}".

I've generated these tools to implement:
${JSON.stringify(tools, null, 2)}

${generatedServerCode ? "I've also generated the initial TypeScript server code implementing these tools." : "I encountered an issue generating the full server code, but we can proceed with configuring the tools."}

Your task is to provide a friendly, helpful message to the user:
1. Explain what MCP tools you've identified for their needs
2. Mention that the server code has been generated
3. Suggest next steps (environment variables, potential improvements, etc.)
4. Ask if they'd like to make any changes to the tools

Be conversational and helpful, explaining your choices.`;

      const welcomeMessages: ChatMessage[] = [
        {
          role: 'system',
          content: welcomeSystemPrompt,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString()
        },
        userMessage
      ];
      
      // Final LLM call - welcome message
      const welcomeResponse = await callGeminiAPI(welcomeMessages);
      
      // Add assistant welcome message
      const welcomeMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: welcomeResponse?.message?.content || "I've analyzed your request and created tools to meet your needs. You can see them in the panel on the right. Let me know if you'd like to make any changes!",
        createdAt: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, welcomeMessage]);
      
      // Create suggested environment variables based on tools
      const suggestedVars = extractPotentialEnvVars(tools, initialQuery);
      setEnvVars(suggestedVars);
      
      // Set initial query as submitted
      setIsInitialQuerySubmitted(true);
      
      // Continue progress animation
      simulateProgress(90, 95);
      
      // Call the callback function if provided
      if (onToolsGenerated) {
        onToolsGenerated(tools, initialQuery);
      }
    } catch (error) {
      console.error("Error during initial generation:", error);
      // Add general error message to chat
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: "I encountered an unexpected error during the setup process. Please try refining your request or starting again.",
        createdAt: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, errorMessage]);
      setBuildProgress(0); // Reset progress on error
    } finally {
      setIsGenerating(false);
      // Ensure progress reaches near completion if successful, or resets if failed
      if (buildProgress > 0 && buildProgress < 90) {
        setBuildProgress(95); // Indicate completion of setup phase
      }
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
      
      // Add generated code context if available
      const serverCodeContext = generatedServerCode 
         ? `\nGenerated Server Code (Partial):\n\`\`\`typescript\n${generatedServerCode.substring(0, 300)}...\n\`\`\`\n(Full code generated initially)` 
         : '\nServer code generation was skipped or failed.';

      // Create system prompt with context
      const systemPrompt = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers based on user requirements. 
        
The user's initial request: "${initialQuery}".

Current tools:
${toolsContext}

${envVarsContext}
${serverCodeContext}

Build progress: ${Math.round(buildProgress)}%

Respond conversationally to the user, helping them refine their MCP server. Focus on practical details like tool parameters, environment variables, and potential issues. ${generatedServerCode ? 'You can also answer questions about the generated server code structure or logic shown.' : ''} Keep responses concise and focused on the next steps.`;
      
      // Format messages for API
      const formattedMessages: ChatMessage[] = [
        {
          role: 'system' as "system",
          content: systemPrompt,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString()
        },
        ...chatMessages
      ];
      
      // Call the Gemini API
      const { callGeminiAPI } = await import('../../lib/api/gemini');
      const response = await callGeminiAPI(formattedMessages);
      
      const responseContent = response?.message?.content || "I'm sorry, I couldn't generate a response. Let's continue building your MCP server.";
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
    const uniqueKeys = Array.from(new Set(allMatches));
    
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
                  <span>Building Your MCP Server...</span>
                </div>
              ) : "Create MCP Server"}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-4">
        
          {/* Left Panel: Chat Interface */}
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

          {/* Right Panel: MCP Tools & Config */}
          <div className="flex-grow overflow-hidden flex flex-col h-full bg-card rounded-md border">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-lg">MCP Tools</h2>
              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-2.5 mt-2">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${buildProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{Math.round(buildProgress)}% Complete</p>
            </div>
            
            {/* Tools Panel */}
            <div className="flex-grow overflow-y-auto p-4 space-y-6">
              {generatedTools.length > 0 ? (
                <div className="space-y-4">
                  {generatedTools.map((tool, index) => (
                    <Card key={tool.id || index} className="overflow-hidden">
                      <div className="bg-blue-500/20 text-foreground border-b border-blue-500/50 px-4 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                              <path d="M14 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
                              <path d="M14 24v-5.5l2.5-2.5-7-7-2.5 2.5L1.5 6"/>
                              <path d="m8.5 8.5 7 7"/>
                              <path d="m15 8 7 7"/>
                            </svg>
                            <span className="font-semibold">{tool.name}</span>
                          </div>
                          <div className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full px-2 py-0.5">
                            {tool.parameters.length} {tool.parameters.length === 1 ? "parameter" : "parameters"}
                          </div>
                        </div>
                        <p className="text-sm mt-1 text-muted-foreground">{tool.description}</p>
                      </div>

                      {tool.parameters.length > 0 && (
                        <div className="p-3 bg-muted/30">
                          <div className="text-xs mb-2 font-medium">Parameters:</div>
                          <div className="space-y-2">
                            {tool.parameters.map((param, pIndex) => (
                              <div key={pIndex} className="text-xs bg-background rounded border p-2">
                                <div className="flex items-center justify-between">
                                  <div className="font-mono font-medium">
                                    {param.name}
                                    {param.required && <span className="text-red-500 ml-1">*</span>}
                                  </div>
                                  <div className="text-muted-foreground">{param.type}</div>
                                </div>
                                <div className="mt-1">{param.description}</div>
                                {param.enum && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {param.enum.map((value, eIndex) => (
                                      <span key={eIndex} className="bg-muted-foreground/20 rounded-sm px-1 text-[10px]">{value}</span>
                                    ))}
                                  </div>
                                )}
                                {param.default !== undefined && (
                                  <div className="mt-1 text-muted-foreground">
                                    Default: <span className="font-mono">{JSON.stringify(param.default)}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                !isGenerating && (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <circle cx="12" cy="12" r="4"/>
                    </svg>
                    <p className="text-sm">No tools generated yet</p>
                  </div>
                )
              )}
              
              {/* Environment Variables Section */}
              {envVars.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold mb-3 mt-6">Environment Variables</h3>
                  <div className="space-y-3">
                    {envVars.map((envVar, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <label htmlFor={`env-${index}`} className="text-sm font-medium w-1/3 truncate">
                          {envVar.name}
                          {envVar.required ? <span className="text-red-500 ml-1">*</span> : ''}
                        </label>
                        <Input
                          id={`env-${index}`}
                          type="text"
                          placeholder={`Enter value for ${envVar.name}`}
                          value={envVar.value}
                          onChange={(e) => handleEnvVarChange(index, e.target.value)}
                          className="flex-grow text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deploy Button */}
              {generatedTools.length > 0 && (
                <div className="pt-4 border-t">
                  <Button className="w-full">Continue to Deployment</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}