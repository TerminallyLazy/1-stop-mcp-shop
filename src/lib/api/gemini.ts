// src/lib/api/gemini.ts
import { ChatMessage } from '../types';

// Define Gemini API types
interface GeminiPart {
  text?: string;
}

interface GeminiMessage {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
      role: string;
    };
  }[];
}

// Simplifies the conversation to follow Gemini's strict message pattern
function convertToGeminiFormat(messages: ChatMessage[]): GeminiMessage[] {
  // Build new array with strict user/model alternating pattern
  let geminiMessages: GeminiMessage[] = [];
  
  // Collect messages by role and combine into a single message for each role
  let userContent: string[] = [];
  let modelContent: string[] = [];
  
  // Special handling for first message to set up the context
  const firstMessage = messages[0];
  if (firstMessage && (firstMessage.role === 'system' || firstMessage.role === 'assistant')) {
    // Start with a model message when first is system or assistant
    modelContent.push(firstMessage.content);
  }
  
  // Process all messages in sequence to handle alternation correctly
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const isToolOrAssistant = message.role === 'tool' || message.role === 'assistant';
    
    if (message.role === 'user') {
      userContent.push(message.content);
    } else if (message.role === 'system') {
      // System messages are instructions we'll add to user context
      userContent.push(`Instructions: ${message.content}`);
    } else if (isToolOrAssistant) {
      // Tool results and assistant messages are model responses
      const content = message.role === 'tool' ? 
        `Tool result for ${message.toolCallId || 'tool'}: ${message.content}` : 
        message.content;
      modelContent.push(content);
    }
    
    // If we have both user and model content or hit the end of messages, add them
    if ((userContent.length > 0 && modelContent.length > 0) || i === messages.length - 1) {
      if (userContent.length > 0) {
        geminiMessages.push({
          role: 'user',
          parts: [{ text: userContent.join('\n\n') }]
        });
        userContent = [];
      }
      
      if (modelContent.length > 0) {
        geminiMessages.push({
          role: 'model',
          parts: [{ text: modelContent.join('\n\n') }]
        });
        modelContent = [];
      }
    }
  }
  
  // If we have odd number of messages, always end with user input
  // since Gemini requires the last message to be from user
  if (geminiMessages.length > 0 && geminiMessages[geminiMessages.length - 1].role === 'model') {
    geminiMessages.push({
      role: 'user',
      parts: [{ text: 'Please continue.' }]
    });
  }
  
  return geminiMessages;
}

export async function callGeminiAPI(messages: ChatMessage[], model: string = 'gemini-2.5-pro-exp-03-25') {
  try {
    console.log('Calling Gemini API with model:', model);
    // Use the actual Gemini API endpoint
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    // Convert our messages to Gemini's expected format
    let geminiMessages = convertToGeminiFormat(messages);
    
    console.log('Converted Gemini messages:', JSON.stringify(geminiMessages));
    
    // Handle the case where we have no messages or only user messages
    if (geminiMessages.length === 0) {
      geminiMessages = [
        {
          role: 'user',
          parts: [{ text: 'Hello, can you help me?' }]
        }
      ];
    }
    
    // Ensure we end with a user message - Gemini requires this
    if (geminiMessages.length > 0 && geminiMessages[geminiMessages.length - 1].role !== 'user') {
      geminiMessages.push({
        role: 'user',
        parts: [{ text: 'Please continue.' }]
      });
    }
    
    const requestData: GeminiRequest = {
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log('Calling Gemini API URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error response: ${response.status}`, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as GeminiResponse;
    console.log('Gemini API response:', data);
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Empty response from Gemini API');
    }

    return {
      success: true,
      message: {
        id: `gemini-${Date.now()}`,
        role: 'assistant',
        content: data.candidates[0].content.parts[0].text,
        createdAt: new Date().toISOString(),
      }
    };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to call Gemini API'
    };
  }
}