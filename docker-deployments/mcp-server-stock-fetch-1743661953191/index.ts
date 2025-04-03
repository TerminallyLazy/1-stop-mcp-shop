import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize MCP server for: create an MCP Server that fetches the latest stock price.
const server = new McpServer({
  name: "create-an-mcp",
  version: "1.0.0",
  capabilities: { tools: {} }
});

// Define tools based on the user request

server.tool(
  "get_stock_price",
  "Fetches the latest stock price for a given stock ticker symbol from a reliable financial data API.",
  {
    tickerSymbol: z.string().describe("The stock ticker symbol (e.g., 'AAPL', 'GOOGL', 'MSFT') for which to retrieve the price.")
  },
  async (params) => {
    try {
      // Basic implementation - replace with actual implementation
      console.log("Executing get_stock_price with params:", params);
      return {
        content: [{ 
          type: "text", 
          text: `Executed get_stock_price with parameters: ${JSON.stringify(params)}` 
        }]
      };
    } catch (error) {
      console.error("Error executing get_stock_price:", error);
      throw new Error(`Failed to execute get_stock_price: ${error.message}`);
    }
  }
);

server.tool(
  "validate_ticker_symbol",
  "Validates whether a given ticker symbol is a valid and recognized stock ticker.",
  {
    tickerSymbol: z.string().describe("The stock ticker symbol to validate.")
  },
  async (params) => {
    try {
      // Basic implementation - replace with actual implementation
      console.log("Executing validate_ticker_symbol with params:", params);
      return {
        content: [{ 
          type: "text", 
          text: `Executed validate_ticker_symbol with parameters: ${JSON.stringify(params)}` 
        }]
      };
    } catch (error) {
      console.error("Error executing validate_ticker_symbol:", error);
      throw new Error(`Failed to execute validate_ticker_symbol: ${error.message}`);
    }
  }
);

// Main function to start the server
async function main() {
  try {
    // Use HTTP transport if PORT is defined, otherwise fall back to stdio
    if (process.env.PORT) {
      const port = parseInt(process.env.PORT, 10) || 3000;
      console.log(`Starting MCP server on port ${port}`);
      const transport = new HttpServerTransport({ port });
      await server.connect(transport);
    } else {
      console.log("Starting MCP server with stdio transport");
      const transport = new StdioServerTransport();
      await server.connect(transport);
    }
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

main().catch(console.error);