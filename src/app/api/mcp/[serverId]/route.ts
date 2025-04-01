// src/app/api/mcp/[serverId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { MCPTool } from '@/lib/types';

/**
 * MCP-compatible server implementation
 * This route handles incoming MCP requests following the MCP specification 
 * https://spec.modelcontextprotocol.io/specification/2025-03-26/
 */

// Helper function to create a JSON-RPC response
function createJsonRpcResponse(id: string, result: any) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id,
    result
  });
}

// Helper function to create a JSON-RPC error response
function createJsonRpcErrorResponse(id: string, code: number, message: string, data?: any) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data
    }
  }, { status: 400 });
}

/**
 * GET handler - Used for SSE (Server-Sent Events) transport
 * This is how agents connect to the MCP server for streaming
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  const serverId = params.serverId;
  console.log(`Received SSE connection request for server: ${serverId}`);
  
  // Look up the server in the database
  try {
    // Fetch server configuration from our database
    const { data: serverData, error: serverError } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('id', serverId)
      .single();
      
    if (serverError) {
      console.error(`Server not found: ${serverError.message}`);
      // For demo purposes, still return a valid response with default metadata
      return new NextResponse(
        `event: connection\ndata: {"jsonrpc":"2.0","result":{"server_info":{"name":"MCP Server ${serverId}","version":"1.0"}}}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        }
      );
    }
    
    // Check if server is expired
    if (serverData.expires_at && new Date(serverData.expires_at) < new Date()) {
      return new NextResponse(
        `event: error\ndata: {"jsonrpc":"2.0","error":{"code":-32000,"message":"Server has expired. Please extend its lifetime or upgrade to premium."}}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        }
      );
    }
    
    // Return SSE headers and initial connection event with server info
    return new NextResponse(
      `event: connection\ndata: {"jsonrpc":"2.0","result":{"server_info":{"name":"${serverData.name || `MCP Server ${serverId}`}","version":"1.0","schema_version":"${serverData.schema_version || '2025-03-26'}"}}}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      }
    );
  } catch (error) {
    console.error('Error handling SSE request:', error);
    return new NextResponse(
      `event: error\ndata: {"jsonrpc":"2.0","error":{"code":-32000,"message":"Internal server error"}}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      }
    );
  }
}

/**
 * POST handler - Used for stdio transport
 * This is how regular HTTP clients communicate with the MCP server
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  const serverId = params.serverId;
  console.log(`Received POST request for server: ${serverId}`);
  
  try {
    // Parse the request body
    const requestData = await request.json();
    console.log('Request data:', requestData);
    
    // Validate JSON-RPC 2.0 request
    if (!requestData.jsonrpc || requestData.jsonrpc !== '2.0') {
      return createJsonRpcErrorResponse('null', -32600, 'Invalid Request: Not a valid JSON-RPC 2.0 request');
    }
    
    const id = requestData.id || 'null';
    const method = requestData.method;
    const params = requestData.params || {};
    
    // Handle different JSON-RPC methods
    switch (method) {
      case 'server.describe':
        // Fetch server from database
        const { data: serverData, error: serverError } = await supabase
          .from('mcp_servers')
          .select('*')
          .eq('id', serverId)
          .single();
          
        if (serverError) {
          console.warn(`Server not found: ${serverError.message}`);
          // Return default metadata
          return createJsonRpcResponse(id, {
            name: `MCP Server ${serverId}`,
            description: "A deployed MCP server from MCP Shop",
            version: "1.0.0",
            schema_version: "2025-03-26",
            transport_types: ["sse", "stdio"],
            capabilities: {
              tools: true,
              resources: false,
              prompts: false,
              sampling: false
            }
          });
        }
        
        // Check if server is expired
        if (serverData.expires_at && new Date(serverData.expires_at) < new Date()) {
          return createJsonRpcErrorResponse(id, -32000, 'Server has expired. Please extend its lifetime or upgrade to premium.');
        }
        
        // Return server metadata from the database
        return createJsonRpcResponse(id, {
          name: serverData.name || `MCP Server ${serverId}`,
          description: serverData.description || "A deployed MCP server from MCP Shop",
          version: "1.0.0",
          schema_version: serverData.schema_version || "2025-03-26",
          transport_types: serverData.transport_types || ["sse", "stdio"],
          capabilities: serverData.capabilities || {
            tools: true,
            resources: false,
            prompts: false,
            sampling: false
          }
        });
        
      case 'server.list_tools':
        // Fetch tools from the database based on serverId
        const { data: toolsData, error: toolsError } = await supabase
          .from('mcp_tools')
          .select('*')
          .eq('server_id', serverId);
          
        if (toolsError || !toolsData || toolsData.length === 0) {
          console.warn(`No tools found for server ${serverId}, using defaults`);
          // Provide default tools if none found in database
          return createJsonRpcResponse(id, [
            {
              name: "get_weather",
              description: "Get current weather for a location",
              parameters: {
                type: "object",
                properties: {
                  location: {
                    type: "string",
                    description: "City name or coordinates"
                  },
                  units: {
                    type: "string",
                    description: "Units for temperature (metric or imperial)",
                    enum: ["metric", "imperial"],
                    default: "metric"
                  }
                },
                required: ["location"]
              }
            },
            {
              name: "calculate",
              description: "Perform mathematical calculations",
              parameters: {
                type: "object",
                properties: {
                  expression: {
                    type: "string",
                    description: "Mathematical expression to evaluate"
                  }
                },
                required: ["expression"]
              }
            }
          ]);
        }
        
        // Convert the tools from the database to the MCP format
        const formattedTools = toolsData.map(tool => {
          // Convert parameters array format to JSONSchema format for MCP
          const requiredParams = (tool.parameters || [])
            .filter((param: any) => param.required)
            .map((param: any) => param.name);
            
          const properties = (tool.parameters || []).reduce((acc: any, param: any) => {
            acc[param.name] = {
              type: param.type,
              description: param.description,
            };
            
            // Add enum if available
            if (param.enum) {
              acc[param.name].enum = param.enum;
            }
            
            // Add default value if available
            if (param.default !== undefined) {
              acc[param.name].default = param.default;
            }
            
            return acc;
          }, {});
          
          return {
            name: tool.name,
            description: tool.description,
            parameters: {
              type: "object",
              properties: properties,
              required: requiredParams
            }
          };
        });
        
        return createJsonRpcResponse(id, formattedTools);
        
      case 'execute_tool':
        // Execute a tool
        if (!params.name) {
          return createJsonRpcErrorResponse(id, -32602, 'Invalid params: Missing tool name');
        }
        
        // First check if this tool exists for this server
        const { data: toolData, error: toolError } = await supabase
          .from('mcp_tools')
          .select('*')
          .eq('server_id', serverId)
          .eq('name', params.name)
          .single();
          
        // If the tool doesn't exist in the database, execute built-in tools
        if (toolError) {
          console.warn(`Tool ${params.name} not found for server ${serverId}, using built-in implementation`);
        } else {
          console.log(`Executing tool ${params.name} for server ${serverId}`);
          
          // Validate parameters against the tool schema
          if (toolData.parameters) {
            const requiredParams = toolData.parameters
              .filter((param: any) => param.required)
              .map((param: any) => param.name);
              
            for (const paramName of requiredParams) {
              if (!params.parameters || params.parameters[paramName] === undefined) {
                return createJsonRpcErrorResponse(id, -32602, `Invalid params: Missing required parameter '${paramName}'`);
              }
            }
          }
        }
        
        // Handle different tools
        switch (params.name) {
          case 'get_weather':
            if (!params.parameters?.location) {
              return createJsonRpcErrorResponse(id, -32602, 'Invalid params: Missing location parameter');
            }
            
            try {
              // For a real implementation, we would call an actual weather API
              // For now, use a simulated response with the actual parameters
              const units = params.parameters?.units || 'metric';
              
              return createJsonRpcResponse(id, {
                success: true,
                type: "weather_data",
                content: {
                  location: params.parameters.location,
                  temperature: {
                    current: Math.round(Math.random() * 20 + 60), // Random temperature between 60-80
                    feels_like: Math.round(Math.random() * 20 + 58),
                    min: Math.round(Math.random() * 10 + 55),
                    max: Math.round(Math.random() * 10 + 70),
                    units: units === 'imperial' ? 'fahrenheit' : 'celsius'
                  },
                  weather: {
                    condition: "Clear",
                    description: "Clear skies",
                    icon: "01d"
                  },
                  humidity: Math.round(Math.random() * 50 + 30), // Random humidity between 30-80%
                  wind: {
                    speed: Math.round(Math.random() * 10 + 2), // Random wind between 2-12
                    direction: "NE"
                  },
                  timestamp: new Date().toISOString()
                }
              });
            } catch (error) {
              console.error('Error executing weather tool:', error);
              return createJsonRpcErrorResponse(id, -32000, `Error executing weather tool: ${error instanceof Error ? error.message : String(error)}`);
            }
            
          case 'calculate':
            if (!params.parameters?.expression) {
              return createJsonRpcErrorResponse(id, -32602, 'Invalid params: Missing expression parameter');
            }
            
            try {
              // Use Function constructor to evaluate the expression (with proper sanitization)
              const expression = params.parameters.expression;
              
              // Enhanced security check - only allow simple math expressions
              if (!/^[0-9+\-*/(). ]+$/.test(expression)) {
                throw new Error('Invalid expression. Only numbers and basic operators are allowed.');
              }
              
              // Prevent potentially dangerous calculations
              if (expression.length > 200) {
                throw new Error('Expression is too long');
              }
              
              // Evaluate the expression
              const result = Function(`'use strict'; return (${expression})`)();
              
              if (typeof result !== 'number' || !isFinite(result)) {
                throw new Error('Expression resulted in an invalid value');
              }
              
              // Format the result nicely
              let formattedResult = result.toString();
              if (Number.isInteger(result)) {
                formattedResult = result.toLocaleString(); // Add commas for readability
              } else if (Math.abs(result) < 0.0000001 || Math.abs(result) > 10000000) {
                formattedResult = result.toExponential(6); // Scientific notation for very small/large numbers
              } else {
                formattedResult = result.toLocaleString(undefined, { 
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 6 
                }); // Up to 6 decimal places
              }
              
              return createJsonRpcResponse(id, {
                success: true,
                type: "calculation_result",
                content: {
                  expression: expression,
                  result: result,
                  formatted_result: formattedResult,
                  calculation_time: new Date().toISOString()
                }
              });
            } catch (error) {
              console.error('Error executing calculator tool:', error);
              return createJsonRpcErrorResponse(id, -32603, `Error calculating expression: ${error instanceof Error ? error.message : String(error)}`);
            }
            
          default:
            // Generic handler for any custom tool not explicitly implemented
            if (toolData) {
              // We found this tool in the database but don't have a specific implementation
              // Return a simulated result based on the parameters
              try {
                const paramInfo = params.parameters ? Object.entries(params.parameters)
                  .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                  .join(', ') : 'none';
                  
                return createJsonRpcResponse(id, {
                  success: true,
                  type: "generic_tool_result",
                  content: {
                    tool: params.name,
                    parameters_received: params.parameters || {},
                    message: `Successfully processed request for ${params.name}`,
                    note: "This is a simulated response. In a production environment, this would implement the actual tool functionality.",
                    timestamp: new Date().toISOString()
                  }
                });
              } catch (error) {
                console.error(`Error executing generic tool ${params.name}:`, error);
                return createJsonRpcErrorResponse(id, -32000, `Error executing tool: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
            
            // Tool not found at all
            return createJsonRpcErrorResponse(id, -32601, `Method not found: Tool '${params.name}' not available`);
        }
        
      default:
        return createJsonRpcErrorResponse(id, -32601, `Method not found: '${method}'`);
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return createJsonRpcErrorResponse('null', -32700, 'Parse error');
  }
}