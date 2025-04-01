// src/app/api/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Root API route handler that can handle multiple API endpoints
 * This handles /api/gemini (without trailing slash) by directly proxying to Gemini's API
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  console.log(`[API Router] Received request at: ${pathname}`);
  
  // Handle the case for /api/gemini (without trailing slash)
  if (pathname === '/api/gemini') {
    console.log('[API Router] Forwarding request to Gemini handler');
    
    // Simply forward the request to our Gemini handler
    const response = await fetch(new URL('/api/gemini/', url.origin), {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    
    if (!response.ok) {
      console.error(`[API Router] Forward failed with status ${response.status}`);
    } else {
      console.log('[API Router] Successfully forwarded request to Gemini handler');
    }
    
    // Return the response from the Gemini handler
    return response;
  }
  
  // For any other API requests
  return NextResponse.json(
    { error: 'Endpoint not found. Please check the API path.' },
    { status: 404 }
  );
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}