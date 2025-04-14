import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize MCP server for: create an MCP Server that fetches the latest stock price
const server = new McpServer({
  name: "create-an-mcp",
  version: "1.0.0",
  capabilities: { tools: {} }
});

// Define tools based on the user request

server.tool(
  "stock_price_fetcher",
  "Fetches the latest stock price for a given stock ticker symbol from an external API.",
  {
    tickerSymbol: z.string().describe("The stock ticker symbol (e.g., 'AAPL', 'GOOG') for which to fetch the price."),
    apiKey: z.string().describe("API key for accessing the stock price data provider. Some APIs require authentication.")
  },
  async (params) => {
    try {
      // Basic implementation - replace with actual implementation
      console.log("Executing stock_price_fetcher with params:", params);
      return {
        content: [{ 
          type: "text", 
          text: `Executed stock_price_fetcher with parameters: ${JSON.stringify(params)}` 
        }]
      };
    } catch (error) {
      console.error("Error executing stock_price_fetcher:", error);
      throw new Error(`Failed to execute stock_price_fetcher: ${error.message}`);
    }
  }
);

server.tool(
  "stock_price_validator",
  "Validates the raw stock price data returned by the stock_price_fetcher.",
  {
    rawStockData: z.number().describe("The raw stock price data returned by the stock_price_fetcher."),
    tickerSymbol: z.string().describe("The stock ticker symbol to validate against. This could be used to check against historical data or known price ranges.")
  },
  async (params) => {
    try {
      // Basic implementation - replace with actual implementation
      console.log("Executing stock_price_validator with params:", params);
      return {
        content: [{ 
          type: "text", 
          text: `Executed stock_price_validator with parameters: ${JSON.stringify(params)}` 
        }]
      };
    } catch (error) {
      console.error("Error executing stock_price_validator:", error);
      throw new Error(`Failed to execute stock_price_validator: ${error.message}`);
    }
  }
);

server.tool(
  "stock_price_formatter",
  "Formats the validated stock price data into a human-readable string.",
  {
    validatedStockPrice: z.number().describe("The validated stock price from the stock_price_validator."),
    tickerSymbol: z.string().describe("The stock ticker symbol."),
    currency: z.string().describe("The currency to display.")
  },
  async (params) => {
    try {
      // Basic implementation - replace with actual implementation
      console.log("Executing stock_price_formatter with params:", params);
      return {
        content: [{ 
          type: "text", 
          text: `Executed stock_price_formatter with parameters: ${JSON.stringify(params)}` 
        }]
      };
    } catch (error) {
      console.error("Error executing stock_price_formatter:", error);
      throw new Error(`Failed to execute stock_price_formatter: ${error.message}`);
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