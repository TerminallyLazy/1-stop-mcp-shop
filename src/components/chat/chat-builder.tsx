"use client";

import React, { useState, useEffect } from 'react';
import { ChatInterface } from './chat-interface';
import { MCP_ToolsPanel } from './tools-panel';
import { ChatMessage, MCPTool } from '../../lib/types';
import { useToast } from '../../components/ui/use-toast';

interface ChatBuilderProps {
  onToolsGenerated?: (tools: MCPTool[], description: string) => void;
}

export function ChatBuilder({ onToolsGenerated }: ChatBuilderProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [generatedTools, setGeneratedTools] = useState<MCPTool[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [initialMode, setInitialMode] = useState(true);
  const [serverName, setServerName] = useState<string>("");
  const [serverDescription, setServerDescription] = useState<string>("");
  const [isDeploying, setIsDeploying] = useState(false);
  const { toast } = useToast();
  
  // Handler for the initial query submission
  const handleInitialSubmit = async (query: string) => {
    setIsGenerating(true);
    
    // Create initial user message with unique ID
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content: query,
      createdAt: new Date().toISOString()
    };
    
    setChatMessages([userMessage]);
    
    try {
      // Import the necessary API functions
      const { generateMCPTools, createDefaultTools } = await import('../../lib/api/mcp');
      
      // Generate tools using the API with specific model
      let tools: MCPTool[];
      try {
        console.log('Generating tools with API...');
        tools = await generateMCPTools(query, "gemini-2.5-pro-exp-03-25");
      } catch (apiError) {
        console.error('Error with API call, using default tools:', apiError);
        tools = createDefaultTools(query);
      }
      
      setGeneratedTools(tools);
      
      // Generate a suitable name and description
      let name = tools.length > 0 && tools[0].name 
        ? `${tools[0].name.charAt(0).toUpperCase() + tools[0].name.slice(1)} MCP Server`
        : "Custom MCP Server";
        
      let description = `An MCP server that provides ${tools.map(t => t.name).join(", ")} capabilities.`;
      
      setServerName(name);
      setServerDescription(description);
      
      // Now generate an assistant response with improved prompt
      const { callGeminiAPI } = await import('../../lib/api/gemini');
      
      // Create enhanced system prompt for Gemini using the Mem0 reference
      const systemPrompt = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers based on user requirements. The user has requested an MCP server with the following description: "${query}".

I've already generated these tools:
${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Your task is to:
1. Create a production-ready MCP server following Anthropic's best practices
2. Identify required API keys or environment variables for each tool
3. Provide implementation guidance for each tool's integration
4. Help the user understand how to deploy and configure their MCP server

The MCP server should be built using Python with FastMCP and follow this structure:
- A main.py file with the FastMCP server setup and tool decorators
- A utils.py file with helper functions for API integrations
- Environment variables for all sensitive information
- Support for both SSE and stdio transport

Remember that MCP tools should be well-documented with clear descriptions and parameter details.
Be conversational but efficient, focusing on practical development details.`;

      // Prepare detailed welcome message with real implementation guidance
      const welcomeMessage = `I'll help you build a complete MCP server based on your requirements. I've analyzed your description and created these initial tools shown in the panel on the right.

Let's implement your MCP server with proper API integrations:

1. **Core Implementation**: Your server will use FastMCP with proper error handling and structured tool responses
2. **Environment Setup**: You'll need to configure these environment variables:
   ${tools.map(t => `- For ${t.name}: ${getRequiredEnvVars(t)}`).join('\n   ')}
3. **Deployment Options**: You can deploy using either SSE transport (as a standalone API) or stdio (embedded in client apps)

I'll provide guidance on implementing each tool with proper API integrations. What specific aspects of the implementation would you like me to focus on first?`;

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: welcomeMessage,
        createdAt: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Set initial mode as false since we've started the conversation
      setInitialMode(false);
      
      // Call the callback if provided
      if (onToolsGenerated) {
        onToolsGenerated(tools, query);
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
  
  // Helper function to determine required environment variables based on tool type
  const getRequiredEnvVars = (tool: MCPTool): string => {
    const toolNameLower = tool.name.toLowerCase();
    
    if (toolNameLower.includes('mem') || toolNameLower.includes('memory')) {
      return "DATABASE_URL, LLM_PROVIDER, LLM_API_KEY, EMBEDDING_MODEL_CHOICE";
    } else if (toolNameLower.includes('search') || toolNameLower.includes('retrieval')) {
      return "API_KEY, SEARCH_ENGINE_ID";
    } else if (toolNameLower.includes('file') || toolNameLower.includes('storage')) {
      return "STORAGE_CONNECTION_STRING";
    } else if (toolNameLower.includes('openai') || toolNameLower.includes('llm')) {
      return "LLM_API_KEY, LLM_MODEL_NAME";
    } else {
      return "API_KEY";
    }
  };
  
  // Handler for sending additional messages in the chat
  const handleSendMessage = async (message: string) => {
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);
    
    try {
      // Create detailed context from the current tools
      const toolsContext = generatedTools.map(tool => 
        `Tool: ${tool.name}
Description: ${tool.description}
Parameters: ${tool.parameters.map((p: { name: any; type: any; required: any; description?: string; }) => 
          `${p.name} (${p.type})${p.required ? ' [required]' : ''} - ${p.description || 'No description'}`).join(', ')}
Implementation: This tool should be implemented using the @mcp.tool() decorator in your main.py file with proper error handling.`
      ).join('\n\n');
      
      // Create enhanced system prompt with real implementation guidance
      const systemPrompt = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers based on user requirements. You provide detailed, technical guidance on building production-ready MCP servers.

The user is building an MCP server with the following tools:
${toolsContext}

Server Configuration:
- Transport: Both SSE and stdio should be supported
- Environment Variables: All sensitive data and configuration should use env vars
- Error Handling: All tools should have proper try/except blocks
- Documentation: All tools should have detailed docstrings

Implementation Reference:
- Use FastMCP from mcp.server.fastmcp
- Create a proper lifespan function to manage resources
- Structure the project with main.py and utils.py
- Follow Python best practices for async functions
- Use proper typing for all parameters

Technical Focus Areas:
1. API Integration: Provide real code for integrating with external APIs
2. Error Handling: Show proper error handling patterns for MCP tools
3. Parameter Validation: Demonstrate input validation techniques
4. Response Formatting: Guide on structuring tool responses
5. Deployment: Explain both SSE and stdio deployment options

Your responses should include specific code examples when relevant and focus on practical implementation details. Keep your responses focused on helping the user implement their MCP server.`;
      
      // Format messages for API
      const formattedMessages: ChatMessage[] = [
        {
          id: `system-${Date.now()}`,
          role: 'system' as 'system',
          content: systemPrompt,
          createdAt: new Date().toISOString()
        },
        ...chatMessages,
        userMessage
      ];
      
      // Call the Gemini API
      const { callGeminiAPI } = await import('../../lib/api/gemini');
      const response = await callGeminiAPI(
        formattedMessages,
        'gemini-2.5-pro-exp-03-25'
      );
      
      const responseContent = response?.message?.content || "I'm sorry, I couldn't generate a response. Let's continue building your MCP server.";
      
      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: responseContent,
        createdAt: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Try to extract and add any new tools mentioned in the response
      extractAndAddTools(responseContent);
      
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
  
  // Enhanced function to extract new tools from LLM responses
  const extractAndAddTools = (response: string) => {
    // Look for tool definitions in the response
    const toolPatterns = [
      // Match @mcp.tool() definitions
      /@mcp\.tool\(\)[\s\n]*async def ([a-zA-Z0-9_]+)/g,
      // Match "Tool: Name" patterns
      /Tool:\s+["']?([a-zA-Z0-9_]+)["']?/gi,
      // Match new tool suggestions
      /(?:new|additional) tool[:\s]+["']?([a-zA-Z0-9_]+)["']?/gi
    ];
    
    const extractedTools: string[] = [];
    
    // Extract tool names using each pattern
    toolPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        if (match[1] && !extractedTools.includes(match[1])) {
          extractedTools.push(match[1]);
        }
      }
    });
    
    // Create new tools for any extracted names that don't already exist
    for (const toolName of extractedTools) {
      if (!generatedTools.some(t => t.name.toLowerCase() === toolName.toLowerCase())) {
        // Try to extract description from the response
        const descriptionPattern = new RegExp(`${toolName}[^:]*:[^:]*?([^.]+)`, 'i');
        const descMatch = response.match(descriptionPattern);
        let description = descMatch ? descMatch[1].trim() : `A tool to ${toolName.replace(/_/g, ' ')}`;
        
        // Create a new tool with enhanced structure
        const newTool: MCPTool = {
          id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: toolName,
          description: description,
          parameters: [
            {
              name: "query",
              type: "string",
              description: "Input for the tool",
              required: true
            }
          ],
          serverId: "mcp-server",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        setGeneratedTools(prev => [...prev, newTool]);
        
        // If callback exists, call it with updated tools
        if (onToolsGenerated) {
          onToolsGenerated([...generatedTools, newTool], serverDescription);
        }
      }
    }
  };
  
  // Handle deployment of MCP server
  const handleDeployMCP = async () => {
    if (generatedTools.length === 0) {
      toast({
        title: "No tools to deploy",
        description: "Please generate tools first before deploying.",
        variant: "destructive"
      });
      return;
    }

    setIsDeploying(true);
    toast({
      title: "Preparing MCP server files",
      description: "Generating Python code with real API integrations...",
    });

    try {
      // Import the deployment function
      const { generateMCPServerDeployment } = await import('../../lib/api/mcp-deployment');
      
      // Generate deployable server files
      const deployment = await generateMCPServerDeployment(
        serverDescription || "Custom MCP Server",
        generatedTools,
        "gemini-2.5-pro-exp-03-25"
      );
      
      // Create a zip file containing all generated files
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      // Add all generated files to the zip
      deployment.files.forEach(file => {
        zip.file(file.filename, file.content);
      });
      
      // Add README
      zip.file('README.md', deployment.readme);
      
      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Create a download link and trigger download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `mcp-${serverDescription.toLowerCase().split(' ')[0]}-server.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Add success message to chat
      const deploymentMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: `I've created a complete MCP server with real API integrations based on your requirements. The server includes:

1. \`main.py\` - MCP server with FastMCP implementation and tool integrations
2. \`utils.py\` - Helper functions for API calls and data processing
3. \`Dockerfile\` - For containerized deployment
4. \`.env.example\` - Environment variable configuration template
5. \`README.md\` - Complete setup and usage instructions

The MCP server can be deployed using Python directly or with Docker. It supports both SSE and stdio transport mechanisms for flexible integration with MCP clients.

To get started, unzip the file and follow the instructions in the README.md.`,
        createdAt: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, deploymentMessage]);
      
      toast({
        title: "MCP Server Ready",
        description: "Your MCP server files have been downloaded successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error deploying MCP server:", error);
      
      toast({
        title: "Deployment Error",
        description: "Failed to generate MCP server files. Please try again.",
        variant: "destructive"
      });
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: "I encountered an error while preparing your MCP server deployment. Let's try again or adjust the server requirements.",
        createdAt: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsDeploying(false);
    }
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      <div className="h-full">
        <ChatInterface 
          messages={chatMessages}
          onSendMessage={initialMode ? handleInitialSubmit : handleSendMessage}
          isLoading={isGenerating || isDeploying}
          initialPrompt={initialMode ? "Describe the MCP server you want to build..." : undefined}
          initialMode={initialMode}
        />
      </div>
      <div className="h-full overflow-hidden">
        <MCP_ToolsPanel 
          tools={generatedTools} 
          serverName={serverName} 
          serverDescription={serverDescription}
          onDeploy={handleDeployMCP}
        />
      </div>
    </div>
  );
}