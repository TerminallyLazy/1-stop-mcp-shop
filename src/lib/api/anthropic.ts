// src/lib/api/anthropic.ts
import { ChatMessage } from '../types';

// Define Anthropic API types
interface AnthropicMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | AnthropicMessageContent[];
  tool_call_id?: string;
}

interface AnthropicMessageContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  tool_use?: {
    name: string;
    parameters: Record<string, any>;
  };
  tool_result?: {
    tool_call_id: string;
    content: string;
  };
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface AnthropicResponse {
  content: AnthropicResponseContent[];
  id: string;
  model: string;
  role: string;
  stop_sequence: string | null;
  type: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicResponseContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  tool_use?: {
    name: string;
    parameters: Record<string, any>;
    id: string;
  };
}

// Convert our message format to Anthropic format with better tool handling
function convertToAnthropicFormat(messages: ChatMessage[]): { anthropicMessages: AnthropicMessage[], systemPrompt?: string } {
  // Extract system messages - Anthropic requires system messages to be passed differently
  const systemMessages = messages.filter(msg => msg.role === 'system');
  let systemPrompt: string | undefined;
  
  // Combine all system messages into a single system prompt
  if (systemMessages.length > 0) {
    systemPrompt = systemMessages.map(msg => msg.content).join('\n\n');
  }
  
  // Filter out system messages and convert the rest
  const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
  
  // Now convert the remaining messages to Anthropic format
  const anthropicMessages: AnthropicMessage[] = nonSystemMessages.map(message => {
    if (message.role === 'tool' && message.toolCallId) {
      // Convert tool messages to user messages for Anthropic compatibility
      // Anthropic doesn't support the 'tool' role
      return {
        role: 'user' as const,
        content: `Tool Result: ${typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}`
      };
    } else if (message.toolCalls && message.toolCalls.length > 0) {
      // Convert messages with tool calls to Anthropic's structured format
      const contents: AnthropicMessageContent[] = [];
      
      // First add any text content
      if (message.content && message.content.trim() !== '') {
        contents.push({
          type: 'text',
          text: message.content
        });
      }
      
      // Then add tool uses
      message.toolCalls.forEach(toolCall => {
        if (toolCall.status === 'success' || toolCall.status === 'error') {
          // This is a completed tool call, add both tool_use and tool_result
          contents.push({
            type: 'tool_use',
            tool_use: {
              name: toolCall.tool,
              parameters: toolCall.args || {}
            }
          });
          
          contents.push({
            type: 'tool_result',
            tool_result: {
              tool_call_id: toolCall.id,
              content: typeof toolCall.result === 'string' 
                ? toolCall.result 
                : JSON.stringify(toolCall.result || {})
            }
          });
        }
      });
      
      // Make sure we only use valid Anthropic roles
      const validRole = (message.role === 'user' || message.role === 'assistant') ? 
        message.role : 'user';
      
      return {
        role: validRole as 'user' | 'assistant',
        content: contents.length > 0 ? contents : message.content
      };
    } else {
      // Ensure we're only using valid Anthropic roles
      const validRole = (message.role === 'user' || message.role === 'assistant') ? 
        message.role : 'user';
      
      // Regular message
      return {
        role: validRole as 'user' | 'assistant',
        content: message.content
      };
    }
  });
  
  return { anthropicMessages, systemPrompt };
}

export async function callAnthropicAPI(messages: ChatMessage[], model: string = 'claude-3-7-sonnet-20250219') {
  try {
    // Get API key from environment
    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key is not configured');
    }

    // Convert messages to Anthropic format with proper system message handling
    const { anthropicMessages, systemPrompt } = convertToAnthropicFormat(messages);
    console.log('Anthropic converted messages:', JSON.stringify(anthropicMessages, null, 2));
    
    // Use standard Claude models with proper versioning
    let fixedModel = model;
    if (model.includes('claude-3-7-sonnet-20250219')) {
      fixedModel = 'claude-3-7-sonnet-20250219'; // Default to Claude 3 Sonnet
    } else if (!model.includes('claude')) {
      fixedModel = 'claude-3-7-sonnet-20250219'; // Default to Claude 3 Sonnet
    }
    
    // Create the request with proper handling of system message
    const requestData: AnthropicRequest = {
      model: fixedModel,
      messages: anthropicMessages,
      temperature: 0.7,
      max_tokens: 4096
    };
    
    // Add system prompt as a top-level parameter if present
    if (systemPrompt) {
      (requestData as any).system = systemPrompt;
    }

    console.log('Calling Anthropic API via proxy with model:', fixedModel);
    
    // Use our server-side proxy to avoid CORS issues
    const response = await fetch('/api/anthropic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    const responseText = await response.text();
    console.log('Anthropic raw response:', responseText);
    
    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} - ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText) as AnthropicResponse;
      console.log('Parsed Anthropic response:', data);
    } catch (e) {
      throw new Error(`Failed to parse Anthropic response: ${responseText}`);
    }
    
    // Extract text content from the response
    let content = '';
    let toolCalls: any[] = [];
    
    if (data.content) {
      // Process all content blocks
      data.content.forEach(block => {
        if (block.type === 'text' && block.text) {
          content += block.text;
        } else if (block.type === 'tool_use' && block.tool_use) {
          // Handle tool use by converting to our format
          toolCalls.push({
            id: block.tool_use.id,
            tool: block.tool_use.name,
            args: block.tool_use.parameters,
            status: 'pending'
          });
        }
      });
    }

    return {
      success: true,
      message: {
        id: `anthropic-${Date.now()}`,
        role: 'assistant',
        content: content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        createdAt: new Date().toISOString(),
      }
    };
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to call Anthropic API'
    };
  }
}
