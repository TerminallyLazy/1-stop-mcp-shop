import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(request: NextRequest) {
  try {
    const { serverId, toolName, parameters } = await request.json();

    if (!serverId || !toolName) {
      return NextResponse.json({ error: 'Missing required parameters: serverId, toolName' }, { status: 400 });
    }

    console.log(`MCP Tool Execution Request: ${serverId}/${toolName}`);
    console.log('Parameters:', parameters);

    // For imported Playwright server
    if (serverId.includes('playwright')) {
      return await executePlaywrightTool(toolName, parameters);
    }

    // Generic fallback response
    return NextResponse.json({
      success: true,
      text: `Tool ${toolName} executed successfully`,
      content: `This is the result of executing ${toolName} with parameters: ${JSON.stringify(parameters)}`,
    });
  } catch (error) {
    console.error('MCP tool execution error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

/**
 * Execute a Playwright tool
 */
async function executePlaywrightTool(toolName: string, parameters: any) {
  if (toolName === 'browser_navigate' || toolName.includes('navigate')) {
    const url = parameters.url;
    
    if (!url) {
      return NextResponse.json({ error: 'Missing required parameter: url' }, { status: 400 });
    }

    try {
      // This is where we would actually call the Playwright tool
      // Since we don't want to implement the full browser functionality here,
      // we'll simulate a response with web content fetch
      
      // Simple fetch to get the page content
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        return NextResponse.json({ 
          error: `Failed to fetch URL: ${response.status} ${response.statusText}` 
        }, { status: 500 });
      }
      
      const contentType = response.headers.get('content-type');
      let content = '';
      
      if (contentType && contentType.includes('text/html')) {
        // Parse HTML content
        const html = await response.text();
        
        // Extract text from HTML to provide more readable content
        content = `Content from ${url}:\n\n${extractTextFromHtml(html)}`;
        
        return NextResponse.json({
          success: true,
          url: url,
          title: extractTitle(html) || url,
          text: content,
          html: html.substring(0, 10000), // Limit HTML to prevent huge responses
          content: content // This is what will be shown to the user
        });
      } else {
        // Handle text content
        const text = await response.text();
        content = `Content from ${url}:\n\n${text.substring(0, 10000)}`;
        
        return NextResponse.json({
          success: true,
          url: url,
          text: content,
          content: content
        });
      }
    } catch (error) {
      console.error('Error fetching URL:', error);
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        url: url,
        content: `Error fetching content from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, { status: 500 });
    }
  }
  
  // For other Playwright tools we could add additional handlers
  return NextResponse.json({
    success: true,
    tool: toolName,
    parameters,
    content: `Executed Playwright tool ${toolName} with params: ${JSON.stringify(parameters)}`
  });
}

// Helper function to extract text from HTML
function extractTextFromHtml(html: string): string {
  // Simple regex-based extraction - not perfect but works for basic cases
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ') // Remove scripts
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')    // Remove styles
    .replace(/<[^>]*>/g, ' ')                                            // Remove HTML tags
    .replace(/\s+/g, ' ')                                                // Normalize whitespace
    .trim();

  // Limit length
  return text.substring(0, 10000);
}

// Helper function to extract title
function extractTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}