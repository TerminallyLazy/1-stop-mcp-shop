import { ToolCall, ChatMessage, MCPServer } from "../../lib/types";
import { callMCPTool } from "../../lib/api/mcp";

/**
 * Enhanced tool handling utilities for the MCP client
 * - Prevents chaining multiple tool calls
 * - Provides improved prompting for follow-up responses
 */

// Cache to prevent duplicate tool calls
const toolCallCache = new Map<string, any>();

/**
 * Process a tool call and generate appropriate follow-up responses
 * This implementation will process only one tool call at a time and
 * instruct the LLM not to make additional tool calls in its response
 */
export async function processToolCall(
  toolCall: ToolCall, 
  servers: MCPServer[],
  updateActiveToolCalls: (callback: (prev: ToolCall[]) => ToolCall[]) => void,
  addMessageToConversation: (message: ChatMessage) => void,
  generateFollowUpResponse: (toolCall: ToolCall, result: any, modelType: string) => Promise<void>,
  modelType: string = ""
) {
  try {
    console.log(`Processing tool call: ${toolCall.tool}`, toolCall);
    
    // Check if we have a cached result for this exact tool call
    const cacheKey = toolCall.requestKey || `${toolCall.tool}-${JSON.stringify(toolCall.args)}`;
    
    if (toolCallCache.has(cacheKey)) {
      console.log(`Using cached result for tool call: ${cacheKey}`);
      const cachedResult = toolCallCache.get(cacheKey);
      
      // Update tool call status to success with cached result
      updateActiveToolCalls(prev => prev.map(tc => 
        tc.id === toolCall.id ? { ...tc, status: 'success', result: JSON.stringify(cachedResult) } : tc
      ));
      
      // Add tool result message to the conversation
      const formattedCachedResult = typeof cachedResult === 'string' 
        ? cachedResult 
        : JSON.stringify(cachedResult, null, 2);
      
      const toolMessage: ChatMessage = {
        id: `tool-${Date.now()}`,
        role: 'tool',
        content: formattedCachedResult,
        toolCallId: toolCall.id,
        createdAt: new Date().toISOString()
      };
      
      addMessageToConversation(toolMessage);
      
      // Generate a follow-up response for cached results with no-tool-call instruction
      await generateFollowUpResponse(toolCall, cachedResult, modelType);
      
      return cachedResult;
    }
    
    // Find the server that has this tool
    const server = servers.find(server => 
      server.tools.some((tool: { name: any; }) => tool.name === toolCall.tool)
    );
    
    if (!server) {
      throw new Error(`No server found with tool: ${toolCall.tool}`);
    }
    
    // Update tool call status to in progress
    updateActiveToolCalls(prev => prev.map(tc => 
      tc.id === toolCall.id ? { ...tc, status: 'in_progress' } : tc
    ));
    
    console.log(`Calling MCP tool: ${toolCall.tool} with args:`, toolCall.args);
    
    // Call the tool following MCP protocol
    const result = await callMCPTool(server.id, toolCall.tool, toolCall.args);
    
    console.log(`Tool call result for ${toolCall.tool}:`, result);
    
    // Cache the result for future use
    toolCallCache.set(cacheKey, result);
    
    // Update the tool call status
    updateActiveToolCalls(prev => prev.map(tc => 
      tc.id === toolCall.id ? { ...tc, status: 'success', result: JSON.stringify(result) } : tc
    ));
    
    // Format the response in MCP-compliant format with special handling for Playwright tools
    let formattedResult = '';
    
    // Special handling for browser_navigate and other Playwright tools
    if (toolCall.tool === 'browser_navigate' || toolCall.tool.includes('navigate') || toolCall.tool.includes('browser')) {
      // For navigation tools, extract and format the content properly
      if (result && result.content) {
        // If result has content property, use it directly
        formattedResult = typeof result.content === 'string' 
          ? result.content 
          : JSON.stringify(result.content, null, 2);
      } else if (result && result.html) {
        // If there's HTML content, use that
        formattedResult = `Content from ${toolCall.args.url || 'webpage'}:\n\n${result.html}`;
      } else if (result && result.text) {
        // If there's text content, use that
        formattedResult = `Content from ${toolCall.args.url || 'webpage'}:\n\n${result.text}`;
      } else {
        // Fallback format
        formattedResult = typeof result === 'string' 
          ? result 
          : JSON.stringify(result, null, 2);
      }
    } else {
      // Default formatting for other tools
      formattedResult = typeof result === 'string' 
        ? result 
        : JSON.stringify(result, null, 2);
    }
    
    // Add tool result message to show in the UI with enhanced formatting
    const toolMessage: ChatMessage = {
      id: `tool-${Date.now()}`,
      role: 'tool',
      content: formattedResult,
      toolCallId: toolCall.id,
      createdAt: new Date().toISOString()
    };
    
    addMessageToConversation(toolMessage);
    
    // Generate a follow-up response but instruct not to use more tools
    await generateFollowUpResponse(toolCall, result, modelType);
    
    return result;
  } catch (error) {
    console.error(`Error processing tool call ${toolCall.id}:`, error);
    
    // Update the tool call status to error
    updateActiveToolCalls(prev => prev.map(tc => 
      tc.id === toolCall.id ? { ...tc, status: 'error', result: `Error: ${error}` } : tc
    ));
    
    // Create error response
    const errorMessage: ChatMessage = {
      id: `tool-error-${Date.now()}`,
      role: 'tool',
      content: `Error calling ${toolCall.tool}: ${error instanceof Error ? error.message : String(error)}`,
      toolCallId: toolCall.id,
      createdAt: new Date().toISOString()
    };
    
    addMessageToConversation(errorMessage);
    
    // Generate a follow-up response for the error
    try {
      await generateFollowUpResponse(toolCall, {
        error: error instanceof Error ? error.message : String(error)
      }, modelType);
    } catch (followUpError) {
      console.error('Error generating follow-up for error:', followUpError);
    }
    
    throw error;
  }
}

/**
 * Create a prompt for the LLM to generate a follow-up response
 * that instructs the model not to make additional tool calls
 */
export function createFollowUpPrompt(
  toolCall: ToolCall, 
  result: any, 
  modelType: string
): ChatMessage {
  // Format the result consistently with special handling for Playwright tools
  let formattedResult = '';
  
  // Special handling for browser_navigate and other Playwright tools to extract the actual content
  if (toolCall.tool === 'browser_navigate' || toolCall.tool.includes('navigate') || toolCall.tool.includes('browser')) {
    // For navigation tools, extract and format the content properly
    if (result && result.content) {
      // If result has content property, use it directly
      formattedResult = typeof result.content === 'string' 
        ? result.content 
        : JSON.stringify(result.content, null, 2);
    } else if (result && result.html) {
      // If there's HTML content, use that
      formattedResult = `Content from ${toolCall.args.url || 'webpage'}:\n\n${result.html}`;
    } else if (result && result.text) {
      // If there's text content, use that
      formattedResult = `Content from ${toolCall.args.url || 'webpage'}:\n\n${result.text}`;
    } else {
      // Fallback format
      formattedResult = typeof result === 'string' 
        ? result 
        : JSON.stringify(result, null, 2);
    }
  } else {
    // Default formatting for other tools
    formattedResult = typeof result === 'string' 
      ? result 
      : JSON.stringify(result, null, 2);
  }
    
  // Handle Anthropic models (Claude) - they need special handling
  if (modelType.includes('anthropic') || modelType.includes('claude')) {
    // For Anthropic, we use user role instead of system and give explicit instructions
    return {
      id: `user-followup-${Date.now()}`,
      role: 'user',
      content: `I used the ${toolCall.tool} tool and got this result:\n\n${formattedResult}\n\n` +
              `Please analyze this information and provide a helpful, conversational response in plain text. ` +
              `Include relevant details from the result in your explanation.\n\n` +
              `IMPORTANT: DO NOT format your response as a tool call. DO NOT use XML tags or code blocks. ` +
              `DO NOT include any functions like get_weather() or tool calls in your response. ` +
              `Just respond in natural language.`,
      createdAt: new Date().toISOString()
    };
  } else if (modelType.startsWith('gemini')) {
    // For Gemini Flash, we need extremely explicit instructions to avoid tool chaining
    if (modelType.includes('flash')) {
      return {
        id: `followup-${Date.now()}`,
        role: 'user',
        content: `Here are the results from the ${toolCall.tool} tool: ${formattedResult}\n\nYou MUST only give a simple, direct response to this information in a conversational way. You will respond as normal, not as a tool call. Once you give your response, unless follow-up is required, you will wait until the user prompts you again.\n\n`,
        createdAt: new Date().toISOString()
      };
    }
    
    // For other Gemini models
    return {
      id: `followup-${Date.now()}`,
      role: 'user',
      content: `Here are the results from the ${toolCall.tool} tool: ${formattedResult}\n\nYou MUST only give a simple, direct response to this information in a conversational way. You will respond as normal, not as a tool call. Once you give your response, unless follow-up is required, you will wait until the user prompts you again.\n\n`,
      createdAt: new Date().toISOString()
    };
  } else {
    // For other models like OpenAI, we use a system message
    return {
      id: `system-${Date.now()}`,
      role: 'system',
      content: `A tool call to "${toolCall.tool}" has just completed with the following result: ${formattedResult}\n\nRespond conversationally to this information. Include specific details from the result (like temperatures, values, etc). Your response should be in natural language without structured formats. Don't say things like "the tool returned" or "according to the data" - just present the information naturally as if you're having a conversation.\n\nIMPORTANT: Do not make any additional tool calls in your response. Just respond conversationally to the information provided.`,
      createdAt: new Date().toISOString()
    };
  }
}
