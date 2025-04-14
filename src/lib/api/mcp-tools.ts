/**
 * MCP Tools Generator - Properly formatted according to Model Context Protocol spec
 * @see https://modelcontextprotocol.io/
 */
import { MCPTool, MCPToolParameter } from '../types';

/**
 * Creates a properly formatted MCP tool following protocol standards
 */
export function createMCPTool(
  name: string,
  description: string,
  parameters: MCPToolParameter[]
): MCPTool {
  // Ensure name is in snake_case format per MCP specification
  const formattedName = formatToSnakeCase(name);
  
  const now = new Date().toISOString();
  
  return {
    id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name: formattedName,
    description,
    parameters: parameters.map(formatParameter),
    serverId: '',
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Format parameter to ensure it meets MCP specifications
 */
function formatParameter(param: MCPToolParameter): MCPToolParameter {
  return {
    name: formatToCamelCase(param.name), // MCP prefers camelCase for parameters
    type: validateParameterType(param.type),
    description: param.description || `Parameter for ${param.name}`,
    required: !!param.required,
    enum: Array.isArray(param.enum) ? param.enum : undefined,
    default: param.default
  };
}

/**
 * Validate and normalize parameter type according to MCP spec
 */
function validateParameterType(type: string): 'string' | 'number' | 'boolean' | 'object' | 'array' {
  const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
  if (validTypes.includes(type)) {
    return type as 'string' | 'number' | 'boolean' | 'object' | 'array';
  }
  
  // Default to string for invalid types
  console.warn(`Invalid parameter type: ${type}. Defaulting to 'string'`);
  return 'string';
}

/**
 * Format a string to snake_case as required by MCP tool names
 */
function formatToSnakeCase(str: string): string {
  // Remove non-alphanumeric characters and replace spaces with underscores
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

/**
 * Format a string to camelCase as preferred by MCP parameter names
 */
function formatToCamelCase(str: string): string {
  // Convert to camelCase
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
      if (index === 0) return match.toLowerCase();
      return match.toUpperCase().replace(/\s+/g, '');
    });
}

/**
 * Generate default MCP tools following the correct spec
 */
export function generateDefaultMCPTools(description: string): MCPTool[] {
  if (description.includes('weather')) {
    return [
      createMCPTool(
        'get_weather',
        'Get current weather conditions for a location',
        [
          {
            name: 'location',
            type: 'string',
            description: 'The city name or location to get weather for',
            required: true
          },
          {
            name: 'units',
            type: 'string',
            description: 'Temperature units (metric or imperial)',
            required: false,
            enum: ['metric', 'imperial'],
            default: 'metric'
          }
        ]
      )
    ];
  }
  
  if (description.includes('calculator') || description.includes('math')) {
    return [
      createMCPTool(
        'calculate_expression',
        'Calculate the result of a mathematical expression',
        [
          {
            name: 'expression',
            type: 'string',
            description: 'The mathematical expression to evaluate',
            required: true
          }
        ]
      )
    ];
  }
  
  if (description.includes('search') || description.includes('information')) {
    return [
      createMCPTool(
        'search_information',
        'Search for information on the internet',
        [
          {
            name: 'query',
            type: 'string',
            description: 'The search query',
            required: true
          },
          {
            name: 'numResults',
            type: 'number',
            description: 'Number of results to return',
            required: false,
            default: 5
          }
        ]
      )
    ];
  }
  
  // Default tool - a simple echo tool
  return [
    createMCPTool(
      'echo_message',
      'Simple echo tool that returns the input message',
      [
        {
          name: 'message',
          type: 'string',
          description: 'Message to echo back',
          required: true
        }
      ]
    )
  ];
}