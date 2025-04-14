# 1-Stop MCP Shop

A comprehensive platform for building, managing, and using Model Context Protocol (MCP) servers with a beautiful UI and intelligent agent integration.

## Features

- **MCP Client UI**: Modern React/Next.js interface for interacting with MCP servers
- **MCP Server Builder**: Create MCP servers with natural language descriptions
- **Archon Agent Swarm**: Multi-agent system for complex reasoning tasks using MCP tools
- **Weather & Financial Data Tools**: Built-in MCP servers for real-time data access
- **Docker Deployment**: Easy deployment of MCP servers with Docker

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+
- Docker (optional, for deployment)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/1-stop-mcp-shop.git
   cd 1-stop-mcp-shop
   ```

2. Install Python dependencies
   ```bash
   pip install -r requirements.txt
   ```

3. Install Node.js dependencies
   ```bash
   npm install
   ```

4. Copy the environment file example
   ```bash
   cp .env.example .env.local
   ```
   Update the API keys in `.env.local` as needed

## Usage

### MCP Client UI

The MCP Client UI provides a modern web interface for interacting with MCP servers.

```bash
python mcp_client_ui.py --server-paths weather_mcp_server.js
```

This will:
1. Start the Next.js frontend server
2. Connect to the specified MCP servers
3. Make them available through the UI at http://localhost:3000/client

You can connect to multiple MCP servers by specifying multiple paths:

```bash
python mcp_client_ui.py --server-paths weather_mcp_server.js weather_server.py
```

### Archon Agent Swarm

The Archon Agent Swarm provides a multi-agent system for complex reasoning tasks.

```bash
python archon_swarm_runner.py --task "Analyze the weather patterns in California for the last week"
```

Optional arguments:
- `--iterations` or `-i`: Number of iterations to run (default: 3)
- `--output` or `-o`: Output file to save results to
- `--verbose` or `-v`: Enable verbose output

## MCP Servers

### Weather MCP Server

The Weather MCP Server provides weather data for locations around the world.

```bash
node weather_mcp_server.js
```

Tools:
- `get_weather(location)`: Get current weather for a location
- `get_forecast(location, days)`: Get weather forecast for a location

### Stock Price MCP Server

The Stock Price MCP Server provides real-time stock price data.

```bash
node docker-deployments/stock-fetcher-mcp-*/index.js
```

Tools:
- `get_stock_price(symbol)`: Get the current stock price for a symbol

## Project Structure

- `src/`: Next.js frontend code
  - `app/`: Next.js app directory
  - `components/`: React components
  - `lib/`: Utility functions
- `agent_tools.py`: MCP integration tools for agents
- `archon_agent_swarm.py`: Archon multi-agent system
- `archon_swarm_runner.py`: CLI for running the Archon swarm
- `mcp_client_ui.py`: CLI for running the MCP Client UI
- `weather_mcp_server.js`: JavaScript MCP server for weather data
- `weather_server.py`: Python MCP server for weather data

## License

Copyright © 2025 Emcee-PRO. All rights reserved.