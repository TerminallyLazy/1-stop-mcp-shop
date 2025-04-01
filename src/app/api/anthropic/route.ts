// src/app/api/anthropic/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * API route that acts as a proxy for Anthropic API calls to avoid CORS issues
 * This route will forward requests to Anthropic API with the API key from server side
 */
export async function POST(request: NextRequest) {
  try {
    // Get the API key from environment variables
    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.error('Anthropic API key is not configured');
      return NextResponse.json(
        { error: 'Anthropic API key is not configured' },
        { status: 500 }
      );
    }
    
    // Parse the request body
    const requestData = await request.json();
    const { model, messages, temperature, max_tokens } = requestData;
    
    // Validate required fields
    if (!model) {
      console.error('Missing model parameter');
      return NextResponse.json(
        { error: 'Missing model parameter' },
        { status: 400 }
      );
    }
    
    if (!messages || !Array.isArray(messages)) {
      console.error('Missing or invalid messages parameter');
      return NextResponse.json(
        { error: 'Missing or invalid messages parameter' },
        { status: 400 }
      );
    }
    
    // Log request details for debugging
    console.log(`Anthropic API Request - Model: ${model}`);
    
    // API URL for Anthropic
    const apiUrl = 'https://api.anthropic.com/v1/messages';
    
    console.log('Calling Anthropic API');
    
    // Prepare request payload
    const payload = {
      model,
      messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 4096
    };
    
    // Forward the request to Anthropic API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });
    
    // Handle response
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Anthropic API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Failed to generate content: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('Anthropic API request successful');
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Error in Anthropic API proxy:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
