import { MCPTool } from '../types';
import { 
  generatePythonMCPServerCode, 
  generateUtilsCode, 
  generateDockerfile, 
  generateEnvExample 
} from './mcp-templates';

/**
 * Generates a complete set of files for MCP server deployment
 */
export async function generateMCPServerDeployment(
  description: string,
  tools: MCPTool[],
  model: string = 'gemini-2.5-pro-exp-03-25'
): Promise<{
  files: { 
    filename: string; 
    content: string;
  }[];
  readme: string;
}> {
  // Default files from our templates
  const files = [
    {
      filename: 'main.py',
      content: generatePythonMCPServerCode(description, tools)
    },
    {
      filename: 'utils.py',
      content: generateUtilsCode(description, tools)
    },
    {
      filename: 'Dockerfile',
      content: generateDockerfile()
    },
    {
      filename: '.env.example',
      content: generateEnvExample(tools)
    }
  ];
  
  // Try to generate enhanced main.py using API if available
  try {
    if (typeof window !== 'undefined') {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      
      if (apiKey) {
        // Format the model name
        const formattedModel = model.includes('/') 
          ? model 
          : model.startsWith('gemini-') 
            ? `models/${model.replace('gemini-', 'gemini/')}` 
            : model;
            
        // Format tools for the prompt
        const toolsString = tools.map(tool => {
          const paramString = tool.parameters.map(p => 
            `      ${p.name} (${p.type})${p.required ? ' [required]' : ''}: ${p.description}`
          ).join('\n');
          
          return `  - ${tool.name}: ${tool.description}
    Parameters:
${paramString}`;
        }).join('\n\n');
          
        // Create a detailed prompt for the LLM
        const prompt = `Create a complete MCP (Model Context Protocol) server implementation in Python following the Anthropic MCP server specifications. This server will: "${description}"

Use the FastMCP framework for implementing the server, following this structure:
1. main.py with FastMCP server and tool implementations
2. utils.py with helper functions for API integrations
3. Proper error handling with try/except blocks
4. Support for both SSE and stdio transport
5. Environment variables for configuration

The server should implement the following tools:

${toolsString}

Base your implementation on this structure from the Mem0 MCP server template:

\`\`\`python
from mcp.server.fastmcp import FastMCP, Context
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from dataclasses import dataclass
from dotenv import load_dotenv
import asyncio
import json
import os

# Initialize FastMCP server
mcp = FastMCP(
    "server-name",
    description="Server description",
    lifespan=server_lifespan,
    host=os.getenv("HOST", "0.0.0.0"),
    port=os.getenv("PORT", "8050")
)

@mcp.tool()
async def tool_name(ctx: Context, param_name: str) -> str:
    """Tool description
    
    Args:
        ctx: The MCP server context
        param_name: Parameter description
    """
    try:
        # Implement tool functionality
        return json.dumps({"status": "success", "data": result})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

async def main():
    transport = os.getenv("TRANSPORT", "sse")
    if transport == 'sse':
        await mcp.run_sse_async()
    else:
        await mcp.run_stdio_async()

if __name__ == "__main__":
    asyncio.run(main())
\`\`\`

For each tool, implement real functionality using appropriate APIs and integrations, not placeholder code.
Include proper error handling with try/except blocks for all tools.
Ensure all tools return properly formatted JSON responses.

Return ONLY the Python code without any markdown formatting, explanations, or comments outside the code.`;
        
        // Set up a safety timeout
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            console.log('Code generation timeout reached, using default template');
            resolve();
          }, 12000);
        });
        
        // Make API request
        const apiCallPromise = (async () => {
          const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: formattedModel,
              prompt: prompt,
              generationConfig: {
                temperature: 0.3,
                topP: 0.95,
                maxOutputTokens: 20000
              }
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0 && 
                data.candidates[0].content && data.candidates[0].content.parts && 
                data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
              
              const generatedCode = data.candidates[0].content.parts[0].text.trim();
              
              // Extract code if it's wrapped in markdown code blocks
              const extractedCode = generatedCode.match(/```python\s*([\s\S]*?)\s*```/) || 
                                    generatedCode.match(/```\s*([\s\S]*?)\s*```/);
              
              if (extractedCode && extractedCode[1]) {
                // Update the main.py file in our array
                const mainPyIndex = files.findIndex(f => f.filename === 'main.py');
                if (mainPyIndex !== -1) {
                  files[mainPyIndex].content = extractedCode[1].trim();
                }
              } else if (generatedCode) {
                // If the code is not wrapped in code blocks, use it directly
                const mainPyIndex = files.findIndex(f => f.filename === 'main.py');
                if (mainPyIndex !== -1) {
                  files[mainPyIndex].content = generatedCode;
                }
              }
            }
          }
        })();
        
        // Race the API call against the timeout
        await Promise.race([apiCallPromise, timeoutPromise]);
      }
    }
  } catch (error) {
    console.error('Error generating enhanced code:', error);
    // Continue with the default files
  }
  
  // Generate a README with instructions
  const readme = `# MCP Server for ${description}

This MCP server provides tools for AI agents following the [Model Context Protocol](https://modelcontextprotocol.io) specification by Anthropic.

## Tools

${tools.map(tool => `### ${tool.name}

${tool.description}

Parameters:
${tool.parameters.map(p => `- \`${p.name}\` (${p.type})${p.required ? ' [required]' : ''}: ${p.description}`).join('\n')}`).join('\n\n')}

## Setup

### Using Python

1. Install dependencies:
   \`\`\`bash
   pip install httpx mcp[cli] python-dotenv
   \`\`\`

2. Create a \`.env\` file based on \`.env.example\`:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Configure your environment variables in the \`.env\` file

4. Run the server:
   \`\`\`bash
   python main.py
   \`\`\`

### Using Docker

1. Build the Docker image:
   \`\`\`bash
   docker build -t mcp/server --build-arg PORT=8050 .
   \`\`\`

2. Run the Docker container:
   \`\`\`bash
   docker run --env-file .env -p 8050:8050 mcp/server
   \`\`\`

## Connecting with MCP Clients

### SSE Configuration

\`\`\`json
{
  "mcpServers": {
    "${description.toLowerCase().replace(/[^a-z0-9]/g, '-')}": {
      "transport": "sse",
      "url": "http://localhost:8050/sse"
    }
  }
}
\`\`\`

### Stdio Configuration

\`\`\`json
{
  "mcpServers": {
    "${description.toLowerCase().replace(/[^a-z0-9]/g, '-')}": {
      "command": "python",
      "args": ["path/to/main.py"],
      "env": {
        "TRANSPORT": "stdio"
      }
    }
  }
}
\`\`\`
`;

  return { files, readme };
}