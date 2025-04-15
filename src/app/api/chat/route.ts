import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

// Import model-specific API functions
import { callGeminiAPI } from '../../../lib/api/gemini';
import { callAnthropicAPI } from '../../../lib/api/anthropic';
import { callOpenRouterAPI } from '../../../lib/api/openrouter';

// Define allowed models
const ALLOWED_MODELS = [
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20240620',
  'claude-3-haiku-20240307',
  'gemini-2.5-pro-exp-03-25',
  'gemini-2.0-flash',
  'gpt-4-turbo',
  'gpt-4o',
  'mistral-large'
];

export const POST = async (request: Request) => {
  try {
    const { messages, model = 'gemini-2.0-flash' } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: messages (must be a non-empty array)' },
        { status: 400 }
      );
    }

    // Verify model is allowed
    if (!ALLOWED_MODELS.includes(model)) {
      return NextResponse.json(
        { error: `Model ${model} is not supported. Allowed models: ${ALLOWED_MODELS.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`Processing chat request for model: ${model} with ${messages.length} messages`);

    // Route to the appropriate API based on model name
    let response;
    
    if (model.startsWith('claude')) {
      response = await callAnthropicAPI(messages);
    } else if (model.startsWith('gemini')) {
      response = await callGeminiAPI(messages, model);
    } else {
      // Use OpenRouter for other models
      response = await callOpenRouterAPI(messages, model);
    }

    // Generate ID for the response (might be useful in logs)
    const id = nanoid();
    console.log(`Generated response with ID: ${id}`, response);

    // Check if we got a valid response
    if (!response || (!response.success && !response.message)) {
      console.error("Invalid response from model API:", response);
      
      // If response failed, create a fallback response that matches expected format
      return NextResponse.json({
        success: false,
        error: response?.error || "Invalid response format from API",
        message: {
          id: `fallback-${Date.now()}`,
          role: 'assistant',
          content: 'I apologize, but I encountered an error processing your request. Please try again.',
          createdAt: new Date().toISOString()
        }
      });
    }

    // Return the response in the format expected by the client
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in /api/chat:', error);
    
    // Return error in the format expected by the client
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
      message: {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        createdAt: new Date().toISOString()
      }
    }, { status: 500 });
  }
}; 