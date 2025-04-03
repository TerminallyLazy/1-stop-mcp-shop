# MCP Shop

A platform for discovering, installing, and using Model Context Protocol (MCP) servers with Large Language Models.

## Key Features

### MCP Server Management

- **Server Discovery**: Find and connect to MCP servers via the Marketplace or by adding them directly.
- **Persistence**: All connected servers remain persistent across page navigation and browser sessions.
- **Multiple Connection Methods**: Add servers via URL, config file, or from the marketplace.

### Client Page Features

- **Clickable Server Cards**: Click on any connected MCP server to see detailed information about its tools.
- **Tool Details View**: View all available tools, their parameters, descriptions, and requirements.
- **Server Management**: Easily add or remove servers from your collection.
- **Connection State**: The connection method (URL or config) is stored with each server.

### Marketplace Integration

- **Shared Server Repository**: Servers added on the Client page also appear in the Marketplace as installed.
- **Categorized Browsing**: Browse available servers by category or search.
- **Install Status**: Marketplace shows which servers are already installed.

## Data Persistence

The application uses `localStorage` with the key `mcp-installed-servers` to store all user's connected servers. This ensures:

1. Servers remain available between page navigation
2. Servers persist across browser sessions
3. Different parts of the application share the same server repository

## Adding MCP Servers

There are multiple ways to add servers:

1. **Marketplace**: Browse and install pre-configured servers
2. **URL**: Connect to a server via a direct URL
3. **Config File**: Upload a configuration file that defines server properties and connection methods
4. **Command Line**: Run standalone MCP servers locally and connect to them

## Using MCP Tools

Once servers are connected, you can:

1. View all available tools by clicking on the server card
2. Chat with AI models that can utilize the connected tools
3. Watch as the AI invokes tools to answer questions

## Implementation Details

The application uses a shared storage system to maintain consistency across different parts of the application:

- The storage key `MCP_SERVERS_STORAGE_KEY` ('mcp-installed-servers') is used consistently
- Both the Marketplace and Client pages reference the same storage
- Server details include connection information for proper reconnection