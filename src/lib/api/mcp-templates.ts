// MCP Server templates based on Mem0 implementation

import { MCPTool } from '../types';

/**
 * Generates Python server code from the Mem0 template
 */
export function generatePythonMCPServerCode(
  description: string,
  tools: MCPTool[]
): string {
  // Generate base code with the server setup
  let code = `from mcp.server.fastmcp import FastMCP, Context
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from dataclasses import dataclass
from dotenv import load_dotenv
import asyncio
import json
import os

load_dotenv()

# Initialize FastMCP server
mcp = FastMCP(
    "mcp-${description.toLowerCase().split(' ')[0]}",
    description="MCP server for ${description}",
    host=os.getenv("HOST", "0.0.0.0"),
    port=os.getenv("PORT", "8050")
)
`;

  // Generate tool implementations
  for (const tool of tools) {
    const paramDefs = tool.parameters.map(p => {
      const typeName = pythonTypeMap(p.type);
      return `${p.name}: ${typeName}${p.required ? '' : ' = None'}`;
    }).join(', ');

    const docString = `"""${tool.description}

    Args:
        ctx: The MCP server provided context
        ${tool.parameters.map(p => `${p.name}: ${p.description || 'Parameter description'}`).join('\n        ')}
    """`;

    code += `
@mcp.tool()
async def ${tool.name}(ctx: Context, ${paramDefs}) -> str:
    ${docString}
    try:
        # Implement real functionality for ${tool.name}

        # Create a response with the parameters provided
        response = {
            "status": "success",
            "message": f"Successfully executed ${tool.name}",
            "data": {
                ${tool.parameters.map(p => `"${p.name}": ${p.name}`).join(',\n                ')}
            }
        }

        return json.dumps(response)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

`;
  }

  // Add main function to run the server
  code += `
async def main():
    transport = os.getenv("TRANSPORT", "sse")
    if transport == 'sse':
        # Run the MCP server with sse transport
        await mcp.run_sse_async()
    else:
        # Run the MCP server with stdio transport
        await mcp.run_stdio_async()

if __name__ == "__main__":
    asyncio.run(main())
`;

  // Format the code as markdown with multiple files
  return `# MCP Server Implementation

## main.py
\`\`\`python
${code}
\`\`\`

## Dockerfile
\`\`\`dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
\`\`\`

## requirements.txt
\`\`\`
mcp>=0.1.0
python-dotenv>=0.19.0
httpx>=0.24.0
\`\`\`

## .env.example
\`\`\`
TRANSPORT=sse
PORT=8050
HOST=0.0.0.0
\`\`\``;
}

/**
 * Generates utils.py for API client setup
 */
export function generateUtilsCode(description: string, tools: MCPTool[]): string {
  return `import os
import json
import httpx
from typing import Dict, Any, Optional, List

# Environment validation
def validate_env_vars() -> List[str]:
    """
    Validates that all required environment variables are set.
    Returns a list of missing environment variables.
    """
    required_vars = [
        ${tools.some(t => t.name.includes('api') || t.name.includes('search')) ? "'API_KEY'," : ""}
        ${tools.some(t => t.name.includes('memory') || t.name.includes('database')) ? "'DATABASE_URL'," : ""}
        ${tools.some(t => t.name.includes('llm') || t.name.includes('embedding')) ? "'LLM_API_KEY'," : ""}
    ]

    missing_vars = []
    for var in required_vars:
        if not os.getenv(var.strip("'")):
            missing_vars.append(var.strip("'"))

    return missing_vars

# HTTP client with timeout and error handling
async def make_api_request(
    url: str,
    method: str = "GET",
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, Any]] = None,
    json_data: Optional[Dict[str, Any]] = None,
    timeout: int = 10
) -> Dict[str, Any]:
    """
    Makes an API request with proper error handling and timeout.

    Args:
        url: The URL to make the request to
        method: HTTP method (GET, POST, etc.)
        params: URL parameters
        headers: HTTP headers
        json_data: JSON data for POST/PUT requests
        timeout: Request timeout in seconds

    Returns:
        Response data as dictionary
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                url,
                params=params,
                headers=headers,
                json=json_data,
                timeout=timeout
            )

            # Raise an exception for 4XX/5XX responses
            response.raise_for_status()

            # Return the JSON response
            return response.json()
    except httpx.HTTPStatusError as exc:
        # Handle HTTP errors (4XX/5XX responses)
        error_detail = f"HTTP error {exc.response.status_code}: {exc.response.text}"
        return {"error": error_detail}
    except httpx.RequestError as exc:
        # Handle request errors (connection errors, timeouts, etc.)
        return {"error": f"Request error: {str(exc)}"}
    except json.JSONDecodeError:
        # Handle JSON parsing errors
        return {"error": "Invalid JSON response"}
    except Exception as exc:
        # Handle any other exceptions
        return {"error": f"Unexpected error: {str(exc)}"}
`;
}

/**
 * Generates Dockerfile for containerization
 */
export function generateDockerfile(): string {
  return `FROM python:3.12-slim

ARG PORT=8050

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \
    httpx>=0.28.1 \
    mcp[cli]>=1.3.0 \
    python-dotenv>=1.0.0

# Copy the MCP server files
COPY main.py utils.py ./

EXPOSE 8050

# Command to run the MCP server
CMD ["python", "main.py"]
`;
}

/**
 * Generates .env.example for configuration
 */
export function generateEnvExample(tools: MCPTool[]): string {
  return `# The transport for the MCP server - either 'sse' or 'stdio' (defaults to SSE if left empty)
TRANSPORT=sse

# Host to bind to if using sse as the transport (leave empty if using stdio)
HOST=0.0.0.0

# Port to listen on if using sse as the transport (leave empty if using stdio)
PORT=8050

${tools.some(t => t.name.includes('api') || t.name.includes('search')) ?
`# API key for external services
API_KEY=your_api_key_here
` : ''}

${tools.some(t => t.name.includes('memory') || t.name.includes('database')) ?
`# Database connection string (if using a database)
DATABASE_URL=postgresql://user:password@host:port/database
` : ''}

${tools.some(t => t.name.includes('llm') || t.name.includes('embedding')) ?
`# LLM provider settings (if using an LLM)
LLM_PROVIDER=openai
LLM_API_KEY=your_openai_key_here
LLM_MODEL=gpt-4o-mini
` : ''}
`;
}

/**
 * Maps MCP types to Python types
 */
function pythonTypeMap(mcpType: string): string {
  switch (mcpType) {
    case 'string': return 'str';
    case 'number': return 'float';
    case 'integer': return 'int';
    case 'boolean': return 'bool';
    case 'object': return 'dict';
    case 'array': return 'list';
    default: return 'Any';
  }
}