import { NextResponse } from 'next/server';
import { generateMCPServerCode } from '../../../../lib/api/mcp';
import { MCPTool } from '../../../../lib/types';

export const POST = async (request: Request) => {
  try {
    const { description, tools, model } = await request.json();

    if (!description) {
      return NextResponse.json(
        { error: 'Missing required field: description' },
        { status: 400 }
      );
    }

    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: tools (must be a non-empty array)' },
        { status: 400 }
      );
    }

    // Call the MCP server code generator
    const code = await generateMCPServerCode(
      description,
      tools as MCPTool[],
      model || 'gemini-2.5-pro-exp-03-25'
    );

    return NextResponse.json({ code });
  } catch (error) {
    console.error('Error in /api/mcp/generate:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}; 