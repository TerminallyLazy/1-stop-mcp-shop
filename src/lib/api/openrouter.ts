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
function convertToOpenRouterFormat(messages: ChatMessage[]): OpenRouterMessage[] {
  return messages.map(message => {
    if (message.role === 'tool' && message.toolCallId) {
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId
      };
    } else {
      return {
        role: message.role,
        content: message.content
      };
    }
  });
}

export async function callOpenRouterAPI(messages: ChatMessage[], model: string = 'openai/gpt-4') {
  try {
    // Use the actual OpenRouter API endpoint
    const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured');
    }

    const openRouterMessages = convertToOpenRouterFormat(messages);
    
    const requestData: OpenRouterRequest = {
      model,
      messages: openRouterMessages,
      temperature: 0.7,
      max_tokens: 2048
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin, // Required by OpenRouter
        'X-Title': 'MCP Shop' // Identify your application to OpenRouter
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as OpenRouterResponse;
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('Empty response from OpenRouter API');
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