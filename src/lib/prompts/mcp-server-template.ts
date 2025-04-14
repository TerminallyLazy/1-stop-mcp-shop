// MCP Server template prompts based on Mem0 implementation

export const MCP_SERVER_SYSTEM_PROMPT = `You are an AI engineering assistant specialized in building MCP (Model Context Protocol) servers following Anthropic's best practices. You create production-ready code with proper error handling, documentation, and API integrations.

Follow this structure for all MCP server implementations:
1. A main.py file with FastMCP server setup and tool decorators
2. A utils.py file with helper functions and client setup
3. A pyproject.toml file for dependencies
4. A Dockerfile for containerization
5. An .env.example file for configuration

Key implementation requirements:
- Support both SSE and stdio transport methods
- Store all sensitive information in environment variables
- Implement comprehensive error handling for all API calls
- Provide clear documentation for all tools and parameters
- Structure the project following Python best practices

Your goal is to create an MCP server that is:
- Production-ready with proper error handling
- Well-documented with clear usage instructions
- Properly integrated with real APIs
- Easy to deploy with Docker or direct Python execution`;

export const MEM0_TEMPLATE_DESCRIPTION = `# Mem0 MCP Server Template

This template provides a ready-to-use implementation of an MCP server that integrates with Mem0 for AI agent memory capabilities. It follows Anthropic's best practices for MCP server design.

## Features

- **save_memory**: Store information in long-term memory with semantic indexing
- **get_all_memories**: Retrieve all stored memories
- **search_memories**: Find relevant memories using semantic search

## Implementation Details

The server uses:
- FastMCP for server implementation
- Mem0.ai client for memory operations
- Environment variables for configuration
- Both SSE and stdio transport options
- Proper error handling and response formatting`;

export const FILE_TEMPLATES = {
  // main.py template with FastMCP server implementation
  "main.py": `from mcp.server.fastmcp import FastMCP, Context
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from dataclasses import dataclass
from dotenv import load_dotenv
from mem0 import Memory
import asyncio
import json
import os

from utils import get_mem0_client

load_dotenv()

# Default user ID for memory operations
DEFAULT_USER_ID = "user"

# Create a dataclass for our application context
@dataclass
class Mem0Context:
    """Context for the Mem0 MCP server."""
    mem0_client: Memory

@asynccontextmanager
async def mem0_lifespan(server: FastMCP) -> AsyncIterator[Mem0Context]:
    """
    Manages the Mem0 client lifecycle.
    
    Args:
        server: The FastMCP server instance
        
    Yields:
        Mem0Context: The context containing the Mem0 client
    """
    # Create and return the Memory client with the helper function in utils.py
    mem0_client = get_mem0_client()
    
    try:
        yield Mem0Context(mem0_client=mem0_client)
    finally:
        # No explicit cleanup needed for the Mem0 client
        pass

# Initialize FastMCP server with the Mem0 client as context
mcp = FastMCP(
    "mcp-mem0",
    description="MCP server for long term memory storage and retrieval with Mem0",
    lifespan=mem0_lifespan,
    host=os.getenv("HOST", "0.0.0.0"),
    port=os.getenv("PORT", "8050")
)        

@mcp.tool()
async def save_memory(ctx: Context, text: str) -> str:
    """Save information to your long-term memory.

    This tool is designed to store any type of information that might be useful in the future.
    The content will be processed and indexed for later retrieval through semantic search.

    Args:
        ctx: The MCP server provided context which includes the Mem0 client
        text: The content to store in memory, including any relevant details and context
    """
    try:
        mem0_client = ctx.request_context.lifespan_context.mem0_client
        messages = [{"role": "user", "content": text}]
        mem0_client.add(messages, user_id=DEFAULT_USER_ID)
        return f"Successfully saved memory: {text[:100]}..." if len(text) > 100 else f"Successfully saved memory: {text}"
    except Exception as e:
        return f"Error saving memory: {str(e)}"

@mcp.tool()
async def get_all_memories(ctx: Context) -> str:
    """Get all stored memories for the user.
    
    Call this tool when you need complete context of all previously memories.

    Args:
        ctx: The MCP server provided context which includes the Mem0 client

    Returns a JSON formatted list of all stored memories, including when they were created
    and their content. Results are paginated with a default of 50 items per page.
    """
    try:
        mem0_client = ctx.request_context.lifespan_context.mem0_client
        memories = mem0_client.get_all(user_id=DEFAULT_USER_ID)
        if isinstance(memories, dict) and "results" in memories:
            flattened_memories = [memory["memory"] for memory in memories["results"]]
        else:
            flattened_memories = memories
        return json.dumps(flattened_memories, indent=2)
    except Exception as e:
        return f"Error retrieving memories: {str(e)}"

@mcp.tool()
async def search_memories(ctx: Context, query: str, limit: int = 3) -> str:
    """Search memories using semantic search.

    This tool should be called to find relevant information from your memory. Results are ranked by relevance.
    Always search your memories before making decisions to ensure you leverage your existing knowledge.

    Args:
        ctx: The MCP server provided context which includes the Mem0 client
        query: Search query string describing what you're looking for. Can be natural language.
        limit: Maximum number of results to return (default: 3)
    """
    try:
        mem0_client = ctx.request_context.lifespan_context.mem0_client
        memories = mem0_client.search(query, user_id=DEFAULT_USER_ID, limit=limit)
        if isinstance(memories, dict) and "results" in memories:
            flattened_memories = [memory["memory"] for memory in memories["results"]]
        else:
            flattened_memories = memories
        return json.dumps(flattened_memories, indent=2)
    except Exception as e:
        return f"Error searching memories: {str(e)}"

async def main():
    transport = os.getenv("TRANSPORT", "sse")
    if transport == 'sse':
        # Run the MCP server with sse transport
        await mcp.run_sse_async()
    else:
        # Run the MCP server with stdio transport
        await mcp.run_stdio_async()

if __name__ == "__main__":
    asyncio.run(main())`,

  // utils.py template for API client setup
  "utils.py": `from mem0 import Memory
import os

# Custom instructions for memory processing
# These aren't being used right now but Mem0 does support adding custom prompting
# for handling memory retrieval and processing.
CUSTOM_INSTRUCTIONS = """
Extract the Following Information:  

- Key Information: Identify and save the most important details.
- Context: Capture the surrounding context to understand the memory's relevance.
- Connections: Note any relationships to other topics or memories.
- Importance: Highlight why this information might be valuable in the future.
- Source: Record where this information came from when applicable.
"""

def get_mem0_client():
    # Get LLM provider and configuration
    llm_provider = os.getenv('LLM_PROVIDER')
    llm_api_key = os.getenv('LLM_API_KEY')
    llm_model = os.getenv('LLM_CHOICE')
    embedding_model = os.getenv('EMBEDDING_MODEL_CHOICE')
    
    # Initialize config dictionary
    config = {}
    
    # Configure LLM based on provider
    if llm_provider == 'openai' or llm_provider == 'openrouter':
        config["llm"] = {
            "provider": "openai",
            "config": {
                "model": llm_model,
                "temperature": 0.2,
                "max_tokens": 2000,
            }
        }
        
        # Set API key in environment if not already set
        if llm_api_key and not os.environ.get("OPENAI_API_KEY"):
            os.environ["OPENAI_API_KEY"] = llm_api_key
            
        # For OpenRouter, set the specific API key
        if llm_provider == 'openrouter' and llm_api_key:
            os.environ["OPENROUTER_API_KEY"] = llm_api_key
    
    elif llm_provider == 'ollama':
        config["llm"] = {
            "provider": "ollama",
            "config": {
                "model": llm_model,
                "temperature": 0.2,
                "max_tokens": 2000,
            }
        }
        
        # Set base URL for Ollama if provided
        llm_base_url = os.getenv('LLM_BASE_URL')
        if llm_base_url:
            config["llm"]["config"]["ollama_base_url"] = llm_base_url
    
    # Configure embedder based on provider
    if llm_provider == 'openai':
        config["embedder"] = {
            "provider": "openai",
            "config": {
                "model": embedding_model or "text-embedding-3-small",
                "embedding_dims": 1536  # Default for text-embedding-3-small
            }
        }
        
        # Set API key in environment if not already set
        if llm_api_key and not os.environ.get("OPENAI_API_KEY"):
            os.environ["OPENAI_API_KEY"] = llm_api_key
    
    elif llm_provider == 'ollama':
        config["embedder"] = {
            "provider": "ollama",
            "config": {
                "model": embedding_model or "nomic-embed-text",
                "embedding_dims": 768  # Default for nomic-embed-text
            }
        }
        
        # Set base URL for Ollama if provided
        embedding_base_url = os.getenv('LLM_BASE_URL')
        if embedding_base_url:
            config["embedder"]["config"]["ollama_base_url"] = embedding_base_url
    
    # Configure Supabase vector store
    config["vector_store"] = {
        "provider": "supabase",
        "config": {
            "connection_string": os.environ.get('DATABASE_URL', ''),
            "collection_name": "mem0_memories",
            "embedding_model_dims": 1536 if llm_provider == "openai" else 768
        }
    }

    # config["custom_fact_extraction_prompt"] = CUSTOM_INSTRUCTIONS
    
    # Create and return the Memory client
    return Memory.from_config(config)`,

  // pyproject.toml for dependencies
  "pyproject.toml": `[project]
name = "mem0-mcp"
version = "0.1.0"
description = "MCP server for integrating long term memory into AI agents with Mem0"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "httpx>=0.28.1",
    "mcp[cli]>=1.3.0",
    "mem0ai>=0.1.88",
    "vecs>=0.4.5"
]`,

  // Dockerfile for containerization
  "Dockerfile": `FROM python:3.12-slim

ARG PORT=8050

WORKDIR /app

# Install uv
RUN pip install uv

# Copy the MCP server files
COPY . .

# Install packages
RUN python -m venv .venv
RUN uv pip install -e .

EXPOSE ${PORT}

# Command to run the MCP server
CMD ["uv", "run", "src/main.py"]`,

  // .env.example for configuration
  ".env.example": `# The transport for the MCP server - either 'sse' or 'stdio' (defaults to SSE if left empty)
TRANSPORT=

# Host to bind to if using sse as the transport (leave empty if using stdio)
HOST=

# Port to listen on if using sse as the transport (leave empty if using stdio)
PORT=

# The provider for your LLM
# Set this to either openai, openrouter, or ollama
# This is needed on top of the base URL for Mem0 (long term memory)
LLM_PROVIDER=

# Base URL for the OpenAI compatible instance (default is https://api.openai.com/v1)
# OpenAI: https://api.openai.com/v1
# Ollama (example): http://localhost:11434/v1
# OpenRouter: https://openrouter.ai/api/v1
LLM_BASE_URL=

# OpenAI: https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key
# Open Router: Get your API Key here after registering: https://openrouter.ai/keys
# Ollama: No need to set this unless you specifically configured an API key
LLM_API_KEY=

# The LLM you want to use for processing memories.
# OpenAI example: gpt-4o-mini
# OpenRouter example: anthropic/claude-3.7-sonnet
# Ollama example: qwen2.5:14b-instruct-8k
LLM_CHOICE=

# The embedding model you want to use to store memories - this needs to be from the same provider as set above.
# OpenAI example: text-embedding-3-small
# Ollama example: nomic-embed-text
EMBEDDING_MODEL_CHOICE=

# Postgres DB URL used for mem0
# Format: postgresql://[user]:[password]@[host]:[port]/[database_name]
# Example: postgresql://postgres:mypassword@localhost:5432/mydb
# For Supabase Postgres connection, you can find this in "Connect" (top middle of Supabase dashboard) -> Transaction pooler
DATABASE_URL=`
};

// Function to generate MCP tool code from tool description
export function generateToolCode(tool: { name: string, description: string, parameters: any[] }): string {
  const paramDefs = tool.parameters.map(p => 
    `${p.name}: ${p.type === 'string' ? 'str' : p.type === 'number' ? 'int' : p.type === 'boolean' ? 'bool' : 'Any'}${p.required ? '' : ' = None'}`
  ).join(', ');
  
  const docstring = `"""${tool.description}

    Args:
        ctx: The MCP server provided context
        ${tool.parameters.map(p => `${p.name}: ${p.description || 'Parameter description'}`).join('\n        ')}
    """`;
  
  return `@mcp.tool()
async def ${tool.name}(ctx: Context, ${paramDefs}) -> str:
    ${docstring}
    try:
        # Implement the tool functionality here
        
        # Return the results
        return json.dumps({"status": "success", "message": f"Successfully executed ${tool.name}"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})`;
}

// Template for README file including setup and usage instructions
export const README_TEMPLATE = `# MCP Server Implementation

This MCP server provides tools for AI agents to interact with external services following the [Model Context Protocol](https://modelcontextprotocol.io) specification by Anthropic.

## Features

{FEATURES}

## Prerequisites

- Python 3.12+
- API keys for required services
- PostgreSQL database (if using vector storage)
- Docker (optional, for containerized deployment)

## Installation

### Using uv (Recommended)

1. Install uv if you don't have it:
   \`\`\`bash
   pip install uv
   \`\`\`

2. Clone this repository:
   \`\`\`bash
   git clone https://github.com/yourusername/your-mcp-repo.git
   cd your-mcp-repo
   \`\`\`

3. Install dependencies:
   \`\`\`bash
   uv pip install -e .
   \`\`\`

4. Create a \`.env\` file based on \`.env.example\`:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

5. Configure your environment variables in the \`.env\` file

### Using Docker

1. Build the Docker image:
   \`\`\`bash
   docker build -t mcp/server --build-arg PORT=8050 .
   \`\`\`

2. Configure your \`.env\` file as above

## Running the Server

### SSE Transport

\`\`\`bash
# Set TRANSPORT=sse in .env then:
uv run src/main.py
\`\`\`

The server will run on http://localhost:8050/sse (or the port specified in your .env)

### Stdio Transport

With stdio, the MCP client itself spins up the MCP server, so nothing to run at this point.

## Integration with MCP Clients

### SSE Configuration

\`\`\`json
{
  "mcpServers": {
    "yourServerName": {
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
    "yourServerName": {
      "command": "path/to/python",
      "args": ["path/to/main.py"],
      "env": {
        "TRANSPORT": "stdio",
        "KEY1": "VALUE1",
        "KEY2": "VALUE2"
      }
    }
  }
}
\`\`\`

## Available Tools

{TOOLS}

## Environment Variables

{ENV_VARS}

## License

MIT
`;