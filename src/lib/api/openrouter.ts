// src/lib/api/openrouter.ts
import { ChatMessage } from '../types';

// Define OpenRouter API types
interface OpenRouterMessage {
  role: string;
  content: string;
  tool_call_id?: string;
  tool_responses?: {
    id: string;
    response: string;
  }[];
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  route?: 'direct' | 'fallback'; // Only valid values according to API error
}

interface OpenRouterResponse {
  choices: {
    message: {
      role: string;
      content: string;
    };
  }[];
}

// Convert our message format to OpenRouter format
function convertToOpenRouterFormat(messages: ChatMessage[], model: string): OpenRouterMessage[] {
  // Anthropic models through OpenRouter don't support 'tool' or 'system' roles
  // They only support 'user' and 'assistant' roles
  const isAnthropicModel = model.startsWith('anthropic/');
  
  if (isAnthropicModel) {
    const result: OpenRouterMessage[] = [];
    
    // Combine all system messages into the first user message
    let systemContent = '';
    
    // Process messages in order
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (message.role === 'system') {
        // Collect system messages to prepend to the next user message
        systemContent += message.content + '\n\n';
      }
      else if (message.role === 'tool') {
        // For Anthropic, convert tool messages to user messages with formatted content
        // Look for the tool call that this result is responding to
        const toolCallId = message.toolCallId;
        const toolName = message.content.includes('"type":"') 
          ? message.content.match(/"type"\s*:\s*"([^"]+)"/) 
            // ? message.content.match(/"type"\s*:\s*"([^"]+)"/)[1]
          : 'tool'
          
        // Create a user message with the tool result
        result.push({
          role: 'user',
          content: `Here's the result from the ${toolName} tool:\n\n${message.content}\n\nPlease analyze this information and provide a helpful response. Do not make additional tool calls.`
        });
      }
      else if (message.role === 'user') {
        // For user messages, include any accumulated system messages
        let userContent = message.content;
        if (systemContent) {
          userContent = `${systemContent}\n\n${userContent}`;
          systemContent = ''; // Reset after using
        }
        
        result.push({
          role: 'user',
          content: userContent
        });
      }
      else if (message.role === 'assistant') {
        // Assistant messages pass through normally
        result.push({
          role: 'assistant',
          content: message.content
        });
      }
    }
    
    // If we have leftover system content but no user message to attach it to,
    // create a user message with just the system content
    if (systemContent) {
      result.push({
        role: 'user',
        content: systemContent.trim()
      });
    }
    
    return result;
  }
  
  // Handle different model formats
  if (model.includes('anthropic')) {
    // For Anthropic models, we need a complete simplification - ONLY user and assistant roles
    // Remove any messages that aren't user or assistant
    const cleanedMessages = messages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
    
    // If there are no remaining messages, ensure we have at least one user message
    if (cleanedMessages.length === 0) {
      return [{
        role: 'user',
        content: 'Hello, I need some assistance.'
      }];
    }
    
    // Make sure the conversation starts with a user message
    if (cleanedMessages.length > 0 && cleanedMessages[0].role !== 'user') {
      cleanedMessages.unshift({
        id: `user-start-${Date.now()}`,
        role: 'user',
        content: 'Hello, I need some assistance.',
        createdAt: new Date().toISOString()
      });
    }
    
    // Ensure we have proper alternation between user and assistant
    const result: OpenRouterMessage[] = [];
    let lastRole = '';
    
    for (const message of cleanedMessages) {
      // Skip empty messages
      if (!message.content || message.content.trim() === '') {
        continue;
      }
      
      // If this role is the same as the last one, combine them
      if (message.role === lastRole) {
        const lastMessage = result[result.length - 1];
        lastMessage.content += '\n\n' + message.content;
      } else {
        result.push({
          role: message.role,
          content: message.content
        });
        lastRole = message.role;
      }
    }
    
    return result;
  } else {
    // For non-Anthropic models, handle other role conversions
    return messages.map(message => {
      // OpenRouter API expects only 'user', 'assistant', or 'system' roles
      if (message.role === 'tool') {
        // Convert tool messages to assistant messages for compatibility
        return {
          role: 'assistant',
          content: `Tool Result [${message.toolCallId || 'unknown'}]: ${message.content}`
        };
      } else {
        // Pass through other roles as-is
        return {
          role: message.role,
          content: message.content
        };
      }
    });
  }
}

export async function callOpenRouterAPI(messages: ChatMessage[], model: string = 'openai/gpt-4o-mini') {
  // Some initial validation and cleanup
  // Ensure no empty messages or invalid roles are sent
  messages = messages.filter(m => m.content && m.content.trim() !== '');
  try {
    // Use the actual OpenRouter API endpoint
    const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured');
    }

    // Add detailed logging for debugging
    console.log('Original messages before conversion:', JSON.stringify(messages.map(m => ({
      role: m.role,
      content_preview: m.content.substring(0, 50) + (m.content.length > 50 ? '...' : '')
    }))));
    
    const openRouterMessages = convertToOpenRouterFormat(messages, model);
    console.log('OpenRouter converted messages:', JSON.stringify(openRouterMessages));
    
    // We'll use the model specified by the user with improved handling for Anthropic models
    let fixedModel = model;
    
    // Fix any known model ID issues - use OpenRouter's specific format for models
    if (model.includes('anthropic')) {
      // For Claude models, ensure we use a stable version tag in OpenRouter's format
      if (model === 'anthropic/claude-3-7-sonnet-20250219' || model.includes('claude-3-7-sonnet')) {
        // Use the latest supported Claude 3 sonnet version
        fixedModel = 'anthropic/claude-3-sonnet@20240229';
      } else if (model === 'anthropic/claude-3-sonnet' || model.includes('claude-3-sonnet')) {
        // Make sure we're using a stable version tag
        fixedModel = 'anthropic/claude-3-sonnet@20240229';
      } else if (model === 'anthropic/claude-3-opus' || model.includes('claude-3-opus')) {
        fixedModel = 'anthropic/claude-3-opus@20240229';
      } else if (model.includes('claude-3')) {
        // Generic fallback for any Claude 3 model
        fixedModel = 'anthropic/claude-3-haiku@20240307';
      }
      
      console.log(`Using OpenRouter model ID for Anthropic: ${fixedModel}`);
    }
    
    const requestData: OpenRouterRequest = {
      model: fixedModel,
      messages: openRouterMessages,
      temperature: 0.7,
      max_tokens: 2048
      // Don't use route parameter as it only accepts 'direct' or 'fallback'
    };

    // Get the current URL in a safe way that works in both browser and server environments
    const referer = typeof window !== 'undefined' ? window.location.origin : 'https://mcp-shop.vercel.app';
    
    console.log('Calling OpenRouter API with model:', fixedModel);
    console.log('Request data:', JSON.stringify(requestData));
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': referer,
        'X-Title': 'MCP Shop',
        'User-Agent': 'MCP Shop/1.0.0' // Add user agent for better tracking
      },
      body: JSON.stringify(requestData)
    });

    const responseText = await response.text();
    console.log('OpenRouter raw response:', responseText);
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} - ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText) as OpenRouterResponse;
      console.log('Parsed OpenRouter response:', data);
    } catch (e) {
      throw new Error(`Failed to parse OpenRouter response: ${responseText}`);
    }
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error(`Empty choices in OpenRouter response: ${JSON.stringify(data)}`);
    }

    return {
      success: true,
      message: {
        id: `openrouter-${Date.now()}`,
        role: 'assistant',
        content: data.choices[0].message.content,
        createdAt: new Date().toISOString(),
      }
    };
  } catch (error) {
    console.error('Error calling OpenRouter API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to call OpenRouter API'
    };
  }
}