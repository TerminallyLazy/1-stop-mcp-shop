// src/app/api/gemini/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * API route that acts as a proxy for Gemini API calls to avoid CORS issues
 * This route will forward requests to Gemini API with the API key from server side
 */
export async function POST(request: NextRequest) {
  try {
    // Get the API key from environment variables
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('Gemini API key is not configured');
      return NextResponse.json(
        { error: 'Gemini API key is not configured' },
        { status: 500 }
      );
    }
    
    // Parse the request body
    const requestData = await request.json();
    const { model, prompt, generationConfig, safetySettings } = requestData;
    
    // Validate required fields
    if (!model) {
      console.error('Missing model parameter');
      return NextResponse.json(
        { error: 'Missing model parameter' },
        { status: 400 }
      );
    }
    
    if (!prompt) {
      console.error('Missing prompt parameter');
      return NextResponse.json(
        { error: 'Missing prompt parameter' },
        { status: 400 }
      );
    }
    
    // Log request details for debugging
    console.log(`Gemini API Request - Model: ${model}`);
    
    // Correct URL construction for Gemini API
    let apiUrl;
    if (model.includes('gemini')) {
      // Handle Gemini models specifically
      if (model.startsWith('gemini-')) {
        // Convert gemini-2.5-pro-exp-03-25 to models/gemini/2.5-pro-exp-03-25
        const modelPath = model.replace('gemini-', 'gemini/');
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelPath}:generateContent?key=${apiKey}`;
      } else if (model.startsWith('models/')) {
        // Already in the correct format
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
      } else {
        // Assume it's directly a model ID like 'gemini/2.5-pro'
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      }
    } else {
      // Generic fallback for other models
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    }
    
    console.log(`Calling Gemini API at: ${apiUrl.replace(apiKey, '[REDACTED]')}`);
    
    // Prepare request payload
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: generationConfig || {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 4096,
        responseFormat: { type: "JSON" }
      },
      safetySettings: safetySettings || [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };
    
    // Forward the request to Gemini API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    // Handle response
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Failed to generate content: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('Gemini API request successful');
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Error in Gemini API proxy:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}