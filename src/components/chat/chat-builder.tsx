"use client";

import React, { useState, useEffect } from 'react';
import { ChatInterface } from './chat-interface';
import { MCP_ToolsPanel } from './tools-panel';
import { ChatMessage, MCPTool } from '@/lib/types';

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
  
  // Handler for the initial query submission
  const handleInitialSubmit = async (query: string) => {
    setIsGenerating(true);
    
    // Create initial user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content: query,
      createdAt: new Date().toISOString()
    };
    
    setChatMessages([userMessage]);
    
    try {
      // Import the necessary API functions
      const { generateMCPTools, createDefaultTools } = await import('@/lib/api/mcp');
      
      // Generate tools using the API or fall back to defaults
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
      
      // Now generate an assistant response
      const { callGeminiAPI } = await import('@/lib/api/gemini');
      
      // Create system prompt for Gemini
      const systemPrompt = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers based on user requirements. The user has requested an MCP server with the following description: "${query}".
        
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
  
  // Handler for sending additional messages in the chat
  const handleSendMessage = async (message: string) => {
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);
    
    try {
      // Create context from the current tools
      const toolsContext = generatedTools.map(tool => 
        `Tool: ${tool.name}\nDescription: ${tool.description}\nParameters: ${tool.parameters.map(p => 
          `${p.name} (${p.type})${p.required ? ' [required]' : ''}`).join(', ')}`
      ).join('\n\n');
      
      // Create system prompt with context
      const systemPrompt = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers based on user requirements. 
        
The user is building an MCP server with the following tools:
${toolsContext}

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
        })),
        {
          role: 'user',
          content: message
        }
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
  
  // Function to try and extract new tools from LLM responses
  const extractAndAddTools = (response: string) => {
    // This is a simple implementation - you might want to make this more sophisticated
    // or have the LLM return structured data instead
    
    const toolPattern = /(?:new|additional) tool[:\s]+["']?([a-zA-Z0-9_]+)["']?/i;
    const match = response.match(toolPattern);
    
    if (match && match[1]) {
      const toolName = match[1];
      
      // Check if tool already exists
      if (!generatedTools.some(t => t.name.toLowerCase() === toolName.toLowerCase())) {
        // Create a new tool with basic structure
        const newTool: MCPTool = {
          id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: toolName,
          description: `A tool to ${toolName.replace(/_/g, ' ')}`,
          parameters: [
            {
              name: "query",
              type: "string",
              description: "Input for the tool",
              required: true
            }
          ],
          serverId: "temp-id",
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
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      <div className="h-full">
        <ChatInterface 
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          onInitialSubmit={handleInitialSubmit}
          isGenerating={isGenerating}
          initialMode={initialMode}
        />
      </div>
      <div className="h-full bg-background">
        <MCP_ToolsPanel 
          tools={generatedTools}
          serverName={serverName}
          serverDescription={serverDescription}
        />
      </div>
    </div>
  );
}