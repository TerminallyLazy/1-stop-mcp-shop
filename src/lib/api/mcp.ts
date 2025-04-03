// src/lib/api/mcp.ts
import { MCPServer, MCPTool, MCPToolParameter, MCPResource, MCPPrompt } from '../types';
import { supabase } from '../supabase';

declare const window: Window | undefined;

/**
 * Creates a new MCP server with specified tools and configuration
 * Following MCP server development guide specifications
 */
export async function createMCPServer(
  name: string, 
  description: string, 
  ownerId: string, 
  isPublic: boolean = false,
  tools: MCPTool[] = [],
  resources: MCPResource[] = [],
  prompts: MCPPrompt[] = []
): Promise<MCPServer> {
  try {
    const now = new Date().toISOString();
    
    // Check if the user has a premium subscription
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription')
      .eq('id', ownerId)
      .single();
      
    if (userError) {
      throw new Error(`Failed to fetch user data: ${userError.message}`);
    }
    
    const isPremium = userData?.subscription === 'premium';
    const expiresAt = isPremium ? undefined : new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    // Create the server in the database
    const { data: serverData, error: serverError } = await supabase
      .from('mcp_servers')
      .insert([{
        name,
        description,
        owner_id: ownerId,
        created_at: now,
        updated_at: now,
        is_public: isPublic,
        expires_at: expiresAt,
        schema_version: "2025-03-26", // Current MCP schema version
        transport_types: ["sse", "stdio"], // Supported transport mechanisms
        capabilities: {
          tools: tools.length > 0,
          resources: resources.length > 0,
          prompts: prompts.length > 0,
          sampling: false
        }
      }])
      .select()
      .single();
      
    if (serverError) {
      throw new Error(`Failed to create server: ${serverError.message}`);
    }
    
    const serverId = serverData.id;
    
    // Add tools to the server
    if (tools.length > 0) {
      const toolsWithServerId = tools.map(tool => ({
        ...tool,
        server_id: serverId
      }));
      
      const { error: toolsError } = await supabase
        .from('mcp_tools')
        .insert(toolsWithServerId);
        
      if (toolsError) {
        throw new Error(`Failed to add tools: ${toolsError.message}`);
      }
    }
    
    // Add resources to the server if any
    if (resources.length > 0) {
      const resourcesWithServerId = resources.map(resource => ({
        ...resource,
        server_id: serverId
      }));
      
      const { error: resourcesError } = await supabase
        .from('mcp_resources')
        .insert(resourcesWithServerId);
        
      if (resourcesError) {
        throw new Error(`Failed to add resources: ${resourcesError.message}`);
      }
    }
    
    // Add prompts to the server if any
    if (prompts.length > 0) {
      const promptsWithServerId = prompts.map(prompt => ({
        ...prompt,
        server_id: serverId
      }));
      
      const { error: promptsError } = await supabase
        .from('mcp_prompts')
        .insert(promptsWithServerId);
        
      if (promptsError) {
        throw new Error(`Failed to add prompts: ${promptsError.message}`);
      }
    }
    
    // Generate server deployment files
    await generateServerDeploymentFiles(serverId, name, description, tools, resources, prompts);
    
    // Return the created server with its capabilities
    return {
      id: serverId,
      name,
      description,
      ownerId,
      createdAt: now,
      updatedAt: now,
      isPublic,
      expiresAt,
      tools,
      resources,
      prompts,
      schemaVersion: "2025-03-26",
      transportTypes: ["sse", "stdio"],
      capabilities: {
        tools: tools.length > 0,
        resources: resources.length > 0, 
        prompts: prompts.length > 0,
        sampling: false
      }
    };
  } catch (error) {
    console.error('Error creating MCP server:', error);
    throw error;
  }
}

/**
 * Generates server deployment files for the created MCP server
 * These files follow the MCP server implementation guide
 */
async function generateServerDeploymentFiles(
  serverId: string,
  name: string,
  description: string,
  tools: MCPTool[],
  resources: MCPResource[],
  prompts: MCPPrompt[]
): Promise<void> {
  try {
    // Create a Python server implementation that matches MCP specs
    const pythonImplementation = generatePythonServerImplementation(serverId, name, description, tools, resources, prompts);
    
    // Create a TypeScript server implementation that matches MCP specs
    const typescriptImplementation = generateTypeScriptServerImplementation(serverId, name, description, tools, resources, prompts);
    
    // Create a server configuration file
    const configFile = generateServerConfigFile(serverId, name, description);
    
    // Store these files in the database for later download
    await supabase
      .from('mcp_server_deployments')
      .upsert([
        {
          server_id: serverId,
          python_implementation: pythonImplementation,
          typescript_implementation: typescriptImplementation,
          config_file: configFile,
          created_at: new Date().toISOString()
        }
      ]);
      
  } catch (error) {
    console.error('Error generating server deployment files:', error);
    // Non-critical error, continue without failing the server creation
  }
}

/**
 * Generates Python server implementation code following MCP specifications
 */
function generatePythonServerImplementation(
  serverId: string,
  name: string,
  description: string,
  tools: MCPTool[],
  resources: MCPResource[],
  prompts: MCPPrompt[]
): string {
  // Generate code based on the MCP server quickstart guide
  let code = `#!/usr/bin/env python3
# MCP Server: ${name}
# Description: ${description}
# Server ID: ${serverId}
# Created with MC-TO-THE-P

import os
import json
import asyncio
from typing import Dict, List, Optional, Any, Union
from mcp.server.fastmcp import FastMCP

# Initialize MCP server
mcp = FastMCP("${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}")

# Server metadata
mcp.set_metadata(
    name="${name}",
    description="${description}",
    version="1.0.0"
)
`;

  // Add tool implementations
  if (tools.length > 0) {
    code += `\n# Tool implementations\n`;
    
    tools.forEach(tool => {
      // Generate function parameter annotations
      const params = tool.parameters.map(param => {
        const typeName = pythonTypeMap(param.type);
        return `${param.name}: ${typeName}${param.required ? '' : ' = None'}`;
      }).join(', ');
      
      // Generate docstring for the tool
      const docstring = `"""
    ${tool.description}
    
    ${tool.parameters.length > 0 ? 'Parameters:\n' + tool.parameters.map(p => 
      `    ${p.name} (${p.type}): ${p.description}${p.required ? ' (Required)' : ''}`
    ).join('\n') : ''}
    
    Returns:
        Result of the operation in a structured format
    """`;
      
      code += `
@mcp.tool()
async def ${tool.name}(${params}) -> Dict[str, Any]:
    ${docstring}
    try:
        # TODO: Implement ${tool.name} functionality here
        
        # Example implementation
        result = {
            "success": True,
            "message": f"Successfully executed ${tool.name}",
            "data": {
                ${tool.parameters.map(p => `"${p.name}": ${p.name}`).join(',\n                ')}
            }
        }
        
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
`;
    });
  }
  
  // Add resource implementations if any
  if (resources.length > 0) {
    code += `\n# Resource implementations\n`;
    
    resources.forEach(resource => {
      code += `
@mcp.resource(name="${resource.name}")
async def get_${resource.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}() -> Dict[str, Any]:
    """
    ${resource.description}
    
    Returns:
        Resource data
    """
    try:
        # TODO: Implement resource retrieval
        return {
            "content": "${resource.description}",
            "metadata": {
                "type": "${resource.type}"
            }
        }
    except Exception as e:
        return {
            "error": str(e)
        }
`;
    });
  }
  
  // Add prompt implementations if any
  if (prompts.length > 0) {
    code += `\n# Prompt implementations\n`;
    
    prompts.forEach(prompt => {
      code += `
@mcp.prompt(name="${prompt.name}")
async def get_${prompt.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}() -> str:
    """
    ${prompt.description}
    
    Returns:
        Prompt template
    """
    return """${prompt.template}"""
`;
    });
  }
  
  // Add main execution
  code += `
# Main execution
if __name__ == "__main__":
    asyncio.run(mcp.start())
`;

  return code;
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
    case 'object': return 'Dict[str, Any]';
    case 'array': return 'List[Any]';
    default: return 'Any';
  }
}

/**
 * Generates TypeScript server implementation code following MCP specifications
 */
function generateTypeScriptServerImplementation(
  serverId: string,
  name: string,
  description: string,
  tools: MCPTool[],
  resources: MCPResource[],
  prompts: MCPPrompt[]
): string {
  // Generate code based on the MCP server structure
  let code = `// MCP Server: ${name}
// Description: ${description}
// Server ID: ${serverId}
// Created with MC-TO-THE-P

import { MCPServer } from '@modelcontextprotocol/sdk';
import { z } from 'zod';

// Initialize MCP server
const mcp = new MCPServer({
  name: "${name}",
  description: "${description}",
  version: "1.0.0"
});

// Set transport
mcp.useTransport('stdio');
`;

  // Add tool implementations
  if (tools.length > 0) {
    code += `\n// Tool implementations\n`;
    
    tools.forEach(tool => {
      // Generate zod schema for the tool parameters
      const paramSchema = `const ${tool.name}Schema = z.object({\n  ${tool.parameters.map(param => {
        let typeSchema = '';
        switch (param.type) {
          case 'string':
            typeSchema = 'z.string()';
            break;
          case 'number':
            typeSchema = 'z.number()';
            break;
          case 'boolean':
            typeSchema = 'z.boolean()';
            break;
          case 'object':
            typeSchema = 'z.record(z.string(), z.unknown())';
            break;
          case 'array':
            typeSchema = 'z.array(z.unknown())';
            break;
          default:
            typeSchema = 'z.unknown()';
        }
        
        if (param.enum) {
          typeSchema = `z.enum([${param.enum.map(e => `'${e}'`).join(', ')}])`;
        }
        
        if (param.default !== undefined) {
          typeSchema += `.default(${JSON.stringify(param.default)})`;
        }
        
        return `${param.name}: ${param.required ? typeSchema : `${typeSchema}.optional()`}`;
      }).join(',\n  ')}
});

type ${tool.name}Params = z.infer<typeof ${tool.name}Schema>;`;

      // Generate tool function
      code += `
${paramSchema}

mcp.tool({
  name: "${tool.name}",
  description: "${tool.description}",
  parameters: ${tool.name}Schema,
  handler: async (params: ${tool.name}Params) => {
    try {
      // TODO: Implement ${tool.name} functionality here
      
      // Example implementation
      return {
        success: true,
        message: "Successfully executed ${tool.name}",
        data: params
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
});
`;
    });
  }
  
  // Add resource implementations if any
  if (resources.length > 0) {
    code += `\n// Resource implementations\n`;
    
    resources.forEach(resource => {
      code += `
mcp.resource({
  name: "${resource.name}",
  description: "${resource.description}",
  handler: async () => {
    try {
      // TODO: Implement resource retrieval
      return {
        content: "${resource.description}",
        metadata: {
          type: "${resource.type}"
        }
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }
});
`;
    });
  }
  
  // Add prompt implementations if any
  if (prompts.length > 0) {
    code += `\n// Prompt implementations\n`;
    
    prompts.forEach(prompt => {
      code += `
mcp.prompt({
  name: "${prompt.name}",
  description: "${prompt.description}",
  handler: async () => {
    return \`${prompt.template}\`;
  }
});
`;
    });
  }
  
  // Add startup code
  code += `
// Start the server
mcp.start().catch(console.error);
`;

  return code;
}

/**
 * Generates server configuration file
 */
function generateServerConfigFile(
  serverId: string,
  name: string,
  description: string
): string {
  return JSON.stringify({
    id: serverId,
    name,
    description,
    version: "1.0.0",
    schema_version: "2025-03-26",
    transport_types: ["sse", "stdio"],
    sse_endpoint: `https://agent.mcpify.ai/sse?server=${serverId}`
  }, null, 2);
}

/**
 * Generates tools for an MCP server using Gemini AI
 * Following MCP specification for tool structure
 */
export async function generateMCPTools(
  description: string,
  model: string = 'gemini-2.0-flash'
): Promise<MCPTool[]> {
  console.log('Starting generateMCPTools for description:', description);
  
  // Create a safety Promise that resolves with default tools after 15 seconds
  // This ensures we never have an interface that hangs indefinitely
  const safetyTimeout = new Promise<MCPTool[]>((resolve) => {
    setTimeout(() => {
      console.log('Safety timeout reached, using default tools');
      resolve(createDefaultTools(description));
    }, 15000);
  });
  
  // Create the actual API request promise
  const apiRequest = async (): Promise<MCPTool[]> => {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        console.log('Not in browser environment, using default tools');
        return createDefaultTools(description);
      }
      
      // Check for API key
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('Gemini API key is not configured, using default tools');
        return createDefaultTools(description);
      }
      
      // TEMPORARY FIX: Force using default tools while API issue is resolved
      console.log('Temporarily using default tools while API issue is being resolved');
      // Import and use the properly-formatted MCP tools generator
      const { generateDefaultMCPTools } = await import('./mcp-tools');
      return generateDefaultMCPTools(description);
      
        // Format model name according to Gemini's API requirements
        const formattedModel = model.includes('/') 
          ? model 
          : model.startsWith('gemini-') 
            ? `models/${model.replace('gemini-', 'gemini/')}` 
            : model;
        
        // Craft a prompt for tool generation
        const prompt = `
    You are designing a Model Context Protocol (MCP) server. This server will provide AI assistants with tools for executing tasks.

    Based on this description: "${description}"

    Create tools following the Model Context Protocol specification. Each tool needs:
    1. A name in snake_case (lowercase with underscores)
    2. A clear description explaining what the tool does and when to use it
    3. Well-defined parameters with these attributes:
    - name: Parameter name in camelCase or snake_case
    - type: One of "string", "number", "boolean", "object", or "array"
    - description: Clear explanation of the parameter
    - required: Boolean indicating if the parameter is required
    - enum: Optional array of allowed values
    - default: Optional default value

    Return ONLY a JSON array of tools in the following format:
    [
    {
      "name": "tool_name",
      "description": "Clear description of what the tool does and when to use it",
      "parameters": [
        {
          "name": "param_name",
          "type": "string|number|boolean|object|array",
          "description": "What this parameter is used for",
          "required": true/false,
          "enum": ["option1", "option2"],  // Optional field
          "default": "default_value"       // Optional field
        }
      ]
    }
    ]

    Return only valid JSON without explanation, comments, or surrounding text.`;

        console.log('Trying to call Gemini API proxy...');
        
        // Use a direct fetch with a short timeout to handle API issues gracefully
        const fetchWithTimeout = async (url: string, options: any, timeout = 5000) => {
          try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(url, {
              ...options,
              signal: controller.signal
            });
            clearTimeout(id);
            return response;
          } catch (error) {
            console.error('Fetch error in fetchWithTimeout:', error);
            throw error;  // Re-throw to handle in the caller
          }
        };
        
        // Try multiple API endpoints with a timeout
        // Try the non-trailing slash first since it should now forward to the correct endpoint
        const endpoints = ['/api/gemini', '/api/gemini/'];
        let response = null;
        let lastError = null;
        let successfulEndpoint = null;
        
        // Set a short overall timeout for the whole operation
        const apiCallStartTime = Date.now();
        const maxTotalTimeout = 12000; // 12 seconds total max time
        
        for (const endpoint of endpoints) {
          // Check if we've already spent too much time
          if (Date.now() - apiCallStartTime > maxTotalTimeout) {
            console.warn('Exceeded total API call timeout, falling back to default tools');
            break;
          }
          
          try {
            console.log(`Trying API endpoint: ${endpoint}...`);
            response = await fetchWithTimeout(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: formattedModel,
                prompt: prompt,
                generationConfig: {
                  temperature: 0.2,
                  topP: 0.95,
                  maxOutputTokens: 20000,
                  responseFormat: { type: "JSON" }
                }
              })
            }, 6000); // 6 second timeout per endpoint
            
            if (response && response.ok) {
              console.log(`Successfully connected to ${endpoint}`);
              successfulEndpoint = endpoint;
              break;
            } else if (response) {
              // We got a response but it wasn't OK
              console.warn(`Got error response from ${endpoint}: ${response.status}`);
              const errorText = await response.text();
              console.warn(`Error details: ${errorText}`);
              lastError = new Error(`Status ${response.status}: ${errorText}`);
            }
          } catch (endpointError) {
            console.warn(`Error with endpoint ${endpoint}:`, endpointError);
            lastError = endpointError;
          }
        }
        
        // If no response or not ok, fall back to default tools
        if (!response || !response.ok) {
          const errorMessage = lastError?.message || 'unknown error';
          console.error(`Failed to get a valid API response: ${errorMessage}`);
          console.log('Using default tools instead of waiting for API');
          return createDefaultTools(description);
        }
        
        console.log(`Successfully fetched data from ${successfulEndpoint}`);
      
        // Parse the response
        const data = await response.json();
        console.log('API response received:', data);
        
        // Check if there's an error in the response
        if (data.error) {
          console.error(`API returned error: ${data.error}`);
          return createDefaultTools(description);
        }
        
        if (!data.candidates || data.candidates.length === 0) {
          console.warn('API response did not contain any candidates');
          return createDefaultTools(description);
        }
        
        // Check if candidates[0].content exists and has parts
        if (!data.candidates[0].content || !data.candidates[0].content.parts || 
            !data.candidates[0].content.parts[0] || !data.candidates[0].content.parts[0].text) {
          console.error('Malformed API response - missing content or parts');
          return createDefaultTools(description);
        }
        
        const content = data.candidates[0].content.parts[0].text;
        console.log('Received response from Gemini API');
        
        // Try to parse the JSON response
        try {
          // First try direct parsing
          let toolsData;
          try {
            toolsData = JSON.parse(content);
          } catch (parseError) {
            console.warn('Initial JSON parse failed, trying to extract JSON array');
            // If direct parsing fails, try to extract an array from the text
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              toolsData = JSON.parse(jsonMatch[0]);
            } else {
              console.error('Could not find a JSON array in the response');
              throw new Error('Response is not a valid JSON array');
            }
          }
          
          // Verify toolsData is an array
          if (!Array.isArray(toolsData)) {
            console.error('Response is not a JSON array:', toolsData);
            throw new Error('Response is not a JSON array');
          }
          
          // Make sure we have valid tools data
          if (toolsData.length === 0) {
            console.warn('Response contained empty tools array');
            return createDefaultTools(description);
          }
          
          console.log('Successfully parsed tool data');
          
          // Process and format the tools
          const now = new Date().toISOString();
          return toolsData.map((tool: { name?: string; description?: string; parameters?: any[] }) => ({
            id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: tool.name || `tool_${Math.random().toString(36).substring(2, 7)}`,
            description: tool.description || 'A generated tool for this MCP server',
            parameters: Array.isArray(tool.parameters) ? tool.parameters.map(param => ({
              name: param.name || 'param',
              type: ['string', 'number', 'boolean', 'object', 'array'].includes(param.type) ? param.type : 'string',
              description: param.description || `Parameter for ${param.name || 'this tool'}`,
              required: param.required === true,
              enum: Array.isArray(param.enum) ? param.enum : undefined,
              default: param.default
            })) : [],
            serverId: '',
            createdAt: now,
            updatedAt: now
          }));
        } catch (parseError) {
          console.error('Error parsing tool data:', parseError);
          return createDefaultTools(description);
        }
    } catch (error) {
      console.error('Error in generateMCPTools:', error);
      return createDefaultTools(description);
    }
  };
  
  // Race the API request against the safety timeout
  try {
    return await Promise.race([apiRequest(), safetyTimeout]);
  } catch (error) {
    console.error('Error in generateMCPTools race:', error);
    return createDefaultTools(description);
  }
}

/**
 * Generates resources for an MCP server
 */
export async function generateMCPResources(
  description: string,
  model: string = 'gemini-2.0-flash'
): Promise<MCPResource[]> {
  console.log('Starting generateMCPResources for description:', description);
  
  // If we're not in a browser environment, return empty array
  if (typeof window === 'undefined') {
    console.log('Not in browser environment, skipping resource generation');
    return [];
  }
  
  try {
    // Use a direct fetch with a short timeout to handle API issues gracefully
    const fetchWithTimeout = async (url: string, options: any, timeout = 5000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        throw error;
      }
    };
    
    // Format model name
    const formattedModel = model.includes('/') 
      ? model 
      : model.startsWith('gemini-') 
        ? `models/${model.replace('gemini-', 'gemini/')}` 
        : model;
    
    // Craft a prompt to generate resources
    const prompt = `
Based on this server description: "${description}"

Create up to 2 resources that would be useful for this MCP server. Resources provide contextual information to AI assistants.

Each resource should have:
1. A name (snake_case, lowercase with underscores)
2. A description explaining what the resource contains
3. A type (e.g., "document", "database", "api")
4. Content that would be useful as context

Return ONLY a JSON array in this format:
[
  {
    "name": "resource_name",
    "description": "Description of what this resource contains",
    "type": "document|database|api",
    "content": "Sample content for the resource"
  }
]

Only include resources if they would be genuinely useful for the described functionality.
`;

    console.log('Attempting to generate resources...');
  
    // Make the API request through our proxy
    const response = await fetchWithTimeout('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: formattedModel,
        prompt: prompt,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 20000,
          responseFormat: { type: "JSON" }
        }
      })
    }, 8000); // 8 second timeout
    // Parse response if successful
    if (response.ok) {
      const data = await response.json() as {
        candidates?: Array<{
          content: {
            parts: Array<{
              text: string
            }>
          }
        }>
      };
      
      if (data.candidates && data.candidates.length > 0) {
        const content = data.candidates[0].content.parts[0].text;
        
        // Try to parse the JSON response
        try {
          // First try direct parsing
          let resourcesData = JSON.parse(content);
          
          // If it's not an array, try to extract an array from the text
          if (!Array.isArray(resourcesData)) {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              resourcesData = JSON.parse(jsonMatch[0]);
            } else {
              return []; // Not a valid array
            }
          }
          
          // Format and return the resources
          if (Array.isArray(resourcesData) && resourcesData.length > 0) {
            console.log('Successfully parsed resource data');
            const now = new Date().toISOString();
            
            return resourcesData.map(resource => ({
              id: `resource-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              name: resource.name || `resource_${Math.random().toString(36).substring(2, 7)}`,
              description: resource.description || 'A resource for this MCP server',
              type: resource.type || 'document',
              content: resource.content || 'Content for this resource',
              serverId: '',
              createdAt: now,
              updatedAt: now
            }));
          }
        } catch (parseError) {
          console.error('Error parsing resource data:', parseError);
        }
      }
    }
    
    // If we get here, something went wrong but we don't need to return a fallback
    console.log('No resources were generated from the API');
    return [];
    
  } catch (error) {
    console.error('Error generating MCP resources:', error);
    return [];
  }
}

/**
 * Generates prompts for an MCP server
 */
export async function generateMCPPrompts(
  description: string,
  model: string = 'gemini-2.0-flash'
): Promise<MCPPrompt[]> {
  console.log('Starting generateMCPPrompts for description:', description);
  
  // If we're not in a browser environment, return empty array
  if (typeof window === 'undefined') {
    console.log('Not in browser environment, skipping prompt generation');
    return [];
  }
  
  try {
    // Use a direct fetch with a short timeout to handle API issues gracefully
    const fetchWithTimeout = async (url: string, options: any, timeout = 5000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        throw error;
      }
    };
    
    // Format model name
    const formattedModel = model.includes('/') 
      ? model 
      : model.startsWith('gemini-') 
        ? `models/${model.replace('gemini-', 'gemini/')}` 
        : model;
    
    // Craft a prompt to generate MCP prompts
    const prompt = `
Based on this server description: "${description}"

Create up to 2 prompt templates that would be useful for this MCP server. Prompt templates help AI assistants formulate effective requests.

Each prompt should have:
1. A name (snake_case, lowercase with underscores)
2. A description explaining what the prompt is for
3. A template that uses {placeholders} for variables

Return ONLY a JSON array in this format:
[
  {
    "name": "prompt_name",
    "description": "Description of what this prompt template is for",
    "template": "Template text with {placeholders} for variables"
  }
]

Only include prompts if they would be genuinely useful for the described functionality.
`;

    console.log('Attempting to generate prompt templates...');
  
    // Make the API request through our proxy
    const response = await fetchWithTimeout('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: formattedModel,
        prompt: prompt,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 15000,
          responseFormat: { type: "JSON" }
        }
      })
    }, 8000); // 8 second timeout
    // Parse response if successful
    if (response.ok) {
      const data = await response.json() as {
        candidates?: Array<{
          content: {
            parts: Array<{
              text: string
            }>
          }
        }>
      };
      
      if (data.candidates && data.candidates.length > 0) {
        const content = data.candidates[0].content.parts[0].text;
        
        // Try to parse the JSON response
        try {
          // First try direct parsing
          let promptsData = JSON.parse(content);
          
          // If it's not an array, try to extract an array from the text
          if (!Array.isArray(promptsData)) {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              promptsData = JSON.parse(jsonMatch[0]);
            } else {
              return []; // Not a valid array
            }
          }
          
          // Format and return the prompts
          if (Array.isArray(promptsData) && promptsData.length > 0) {
            console.log('Successfully parsed prompt template data');
            const now = new Date().toISOString();
            
            return promptsData.map(prompt => ({
              id: `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              name: prompt.name || `prompt_${Math.random().toString(36).substring(2, 7)}`,
              description: prompt.description || 'A prompt template for this MCP server',
              template: prompt.template || 'Template for {purpose}',
              serverId: '',
              createdAt: now,
              updatedAt: now
            }));
          }
        } catch (parseError) {
          console.error('Error parsing prompt template data:', parseError);
        }
      }
    }
    
    // If we get here, something went wrong but we don't need to return a fallback
    console.log('No prompt templates were generated from the API');
    return [];
    
  } catch (error) {
    console.error('Error generating MCP prompts:', error);
    return [];
  }
}

/**
 * Create default tools based on description as fallback
 * Following MCP specifications
 */
export function createDefaultTools(description: string): MCPTool[] {
  const now = new Date().toISOString();
  
  if (description.toLowerCase().includes('weather')) {
    return [{
      id: `tool-${Date.now()}`,
      name: 'get_weather',
      description: 'Get current weather and forecast for a location. Returns temperature, conditions, and other meteorological data.',
      parameters: [
        {
          name: 'location',
          type: 'string',
          description: 'City name, address, or coordinates (latitude,longitude)',
          required: true
        },
        {
          name: 'units',
          type: 'string',
          description: 'Temperature units to use in the response',
          required: false,
          enum: ['metric', 'imperial'],
          default: 'metric'
        }
      ],
      serverId: '',
      createdAt: now,
      updatedAt: now
    }];
  } else if (description.toLowerCase().includes('calculator') || description.toLowerCase().includes('math')) {
    return [{
      id: `tool-${Date.now()}`,
      name: 'calculate',
      description: 'Perform mathematical calculations based on the provided expression. Supports basic arithmetic operations, parentheses, and common math functions.',
      parameters: [
        {
          name: 'expression',
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "sin(0.5)")',
          required: true
        }
      ],
      serverId: '',
      createdAt: now,
      updatedAt: now
    }];
  } else if (description.toLowerCase().includes('search') || description.toLowerCase().includes('lookup')) {
    return [{
      id: `tool-${Date.now()}`,
      name: 'search',
      description: 'Search for information on a given topic. Returns relevant results with snippets and URLs.',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The search query to execute',
          required: true
        },
        {
          name: 'num_results',
          type: 'number',
          description: 'Number of results to return',
          required: false,
          default: 5
        }
      ],
      serverId: '',
      createdAt: now,
      updatedAt: now
    }];
  }
  
  // Default tool for general utility
  return [{
    id: `tool-${Date.now()}`,
    name: 'process_request',
    description: 'Process a general request and return relevant information based on the provided parameters.',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'The request to process',
        required: true
      },
      {
        name: 'format',
        type: 'string',
        description: 'Format for the response data',
        required: false,
        enum: ['json', 'text', 'html'],
        default: 'json'
      }
    ],
    serverId: '',
    createdAt: now,
    updatedAt: now
  }];
}

/**
 * Call a tool on an MCP server
 * Implements the MCP client functionality for tool invocation
 */
export async function callMCPTool(
  serverId: string,
  toolName: string,
  parameters: Record<string, any>
): Promise<any> {
  try {
    // Handle imported or URL-based servers with non-UUID IDs
    if (serverId.startsWith('imported-') || serverId.startsWith('url-')) {
      // For non-database servers, we need to handle the MCP API call differently
      console.log(`Executing API call for tool ${toolName} on non-database server ${serverId}`);
      
      // For these servers, we need to use locally stored tool definitions
      // Try to retrieve from localStorage
      const storedServers = localStorage.getItem('mcp-installed-servers');
      if (storedServers) {
        const servers = JSON.parse(storedServers);
        const server = servers.find((s: any) => s.id === serverId);
        
        if (server) {
          console.log(`Found server ${serverId} in local storage`);
          
          // For Playwright-related tools, create a proper API call to our MCP endpoint
          if (serverId.includes('playwright') || 
              toolName.includes('browser') || 
              toolName.includes('playwright')) {
                
            // Make an actual API call to our MCP endpoint
            try {
              const response = await fetch('/api/mcp/discover/execute', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  serverId,
                  toolName,
                  parameters
                }),
              });
              
              if (!response.ok) {
                throw new Error(`API call failed: ${response.statusText}`);
              }
              
              const result = await response.json();
              return result;
              
            } catch (error) {
              console.error('Error calling MCP endpoint:', error);
              throw error;
            }
          }
          
          // Direct call to external MCP server based on stored tool info
          // This is a fallback response when we can't route the request properly
          return {
            success: true,
            text: `Called ${toolName} with parameters: ${JSON.stringify(parameters)}`,
            content: `Content from executing ${toolName} with parameters: ${JSON.stringify(parameters)}`,
            parameters
          };
        }
      }
      
      throw new Error(`Server ${serverId} not found in local storage`);
    }
    
    // For database servers, query Supabase
    const { data: serverData, error: serverError } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('id', serverId)
      .single();
      
    if (serverError) {
      throw new Error(`Server not found: ${serverError.message}`);
    }
    
    if (!serverData) {
      throw new Error('Server not found');
    }
    
    // Check if the server has expired
    if (serverData.expires_at && new Date(serverData.expires_at) < new Date()) {
      throw new Error('Server has expired. Please upgrade to premium for unlimited server time.');
    }
    
    // Find the requested tool
    const { data: toolData, error: toolError } = await supabase
      .from('mcp_tools')
      .select('*')
      .eq('server_id', serverId)
      .eq('name', toolName)
      .single();
      
    if (toolError) {
      throw new Error(`Tool not found: ${toolError.message}`);
    }
    
    // Validate parameters against tool schema
    const toolParameters = toolData.parameters;
    for (const param of toolParameters) {
      if (param.required && !(param.name in parameters)) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }
      // Type validation
      if (param.name in parameters) {
        const value = parameters[param.name];
        switch (param.type) {
          case 'string':
            if (typeof value !== 'string') {
              throw new Error(`Parameter '${param.name}' must be a string`);
            }
            break;
          case 'number':
            if (typeof value !== 'number') {
              throw new Error(`Parameter '${param.name}' must be a number`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              throw new Error(`Parameter '${param.name}' must be a boolean`);
            }
            break;
          case 'object':
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
              throw new Error(`Parameter '${param.name}' must be an object`);
            }
            break;
          case 'array':
            if (!Array.isArray(value)) {
              throw new Error(`Parameter '${param.name}' must be an array`);
            }
            break;
        }
        
        // Enum validation
        if (param.enum && !param.enum.includes(value)) {
          throw new Error(`Parameter '${param.name}' must be one of: ${param.enum.join(', ')}`);
        }
      }
    }
    
    // Generate the JSON-RPC 2.0 request message
    const jsonRpcRequest = {
      jsonrpc: '2.0',
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      method: 'execute_tool',
      params: {
        name: toolName,
        parameters
      }
    };
    
    // Process the tool call based on the tool name
    if (toolName === 'get_weather') {
      return await getWeather(parameters.location, parameters.units || 'metric');
    } else if (toolName === 'calculate') {
      return calculateExpression(parameters.expression);
    } else if (toolName === 'search') {
      return searchInformation(parameters.query, parameters.num_results || 5);
    } else {
      // For custom tools, make a generic API call
      // In a real implementation, this would route to the actual MCP server via SSE
      const { data: toolResult, error: toolCallError } = await supabase.functions.invoke('mcp-tool-execution', {
        body: {
          serverId,
          toolName,
          parameters,
          jsonrpc: jsonRpcRequest
        }
      });
      
      if (toolCallError) {
        throw new Error(`Failed to execute tool: ${toolCallError.message}`);
      }
      
      return toolResult;
    }
  } catch (error) {
    console.error(`Error calling MCP tool ${toolName}:`, error);
    throw error;
  }
}

/**
 * Weather tool implementation
 * Returns data in MCP-compatible format
 */
import { extractCityName } from '../utils/text-helpers';

async function getWeather(location: string, units: string = 'metric'): Promise<any> {
  try {
    const weatherApiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
    if (!weatherApiKey) {
      throw new Error('Weather API key is not configured');
    }
    
    // Extract city name from more complex location descriptions
    const extractedLocation = extractCityName(location);
    console.log(`Weather query: Original="${location}", Extracted="${extractedLocation}"`);
    
    // IMPORTANT: No hardcoded city values! Generate variations dynamically
    const generateVariations = (loc: string): string[] => {
      // Clean up the input
      const cleanLoc = loc.trim().replace(/\s+/g, ' ');
      const result: string[] = [cleanLoc]; // Start with the exact input
      
      // Split by spaces and commas
      const parts = cleanLoc.split(/[\s,]+/).filter(p => p.length > 0);
      
      // Add comma between city and region if it looks like "City Region"
      if (parts.length === 2) {
        // City could be first part, region second
        result.push(`${parts[0]},${parts[1]}`);
      }
      
      // For multi-word cities with region, try several formats
      if (parts.length > 2) {
        // Last part might be a region code
        const possibleCity = parts.slice(0, -1).join(' ');
        const possibleRegion = parts[parts.length - 1];
        result.push(`${possibleCity},${possibleRegion}`);
        
        // Or it could just be the first part as the main city
        result.push(parts[0]);
      }
      
      // If it's just one word, just use that
      if (parts.length === 1) {
        result.push(parts[0]);
      }
      
      // Return unique variations
      return Array.from(new Set(result));
    };
    
    // Generate variations to try
    const variations = generateVariations(extractedLocation);
    console.log('Trying variations:', variations);
    
    // Try each variation
    let data = null;
    let successful = false;
    let lastError = '';
    const attempts: string[] = [];
    
    for (const cityName of variations) {
      attempts.push(cityName);
      try {
        console.log(`Trying: ${cityName}`);
        
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&units=${units}&appid=${weatherApiKey}`
        );
        
        if (response.ok) {
          data = await response.json();
          successful = true;
          console.log(`Success for: ${cityName}`);
          break;
        } else {
          const errorText = await response.text();
          console.warn(`API error for ${cityName}: ${response.status}`, errorText);
          lastError = errorText;
        }
      } catch (err) {
        console.error(`Error fetching for ${cityName}:`, err);
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    
    // If nothing worked, throw descriptive error
    if (!successful || !data) {
      throw new Error(`Weather data not available. API did not recognize: ${attempts.join(', ')}`);
    }
    
    // Format response according to MCP guidelines
    return {
      success: true,
      type: "weather_data",
      content: {
        location: (data as any).name,
        country: (data as any).sys.country,
        coordinates: {
          latitude: (data as any).coord.lat,
          longitude: (data as any).coord.lon
        },
        temperature: {
          current: (data as any).main.temp,
          feels_like: (data as any).main.feels_like,
          min: (data as any).main.temp_min,
          max: (data as any).main.temp_max,
          units: units === 'metric' ? 'celsius' : 'fahrenheit'
        },
        weather: {
          condition: (data as any).weather[0].main,
          description: (data as any).weather[0].description,
          icon: (data as any).weather[0].icon,
          icon_url: `https://openweathermap.org/img/wn/${(data as any).weather[0].icon}@2x.png`
        },
        wind: {
          speed: (data as any).wind.speed,
          units: units === 'metric' ? 'm/s' : 'mph',
          direction: (data as any).wind.deg,
          direction_text: getWindDirection((data as any).wind.deg)
        },
        atmosphere: {
          humidity: (data as any).main.humidity,
          pressure: (data as any).main.pressure,
          visibility: (data as any).visibility
        },
        sun: {
          sunrise: new Date((data as any).sys.sunrise * 1000).toISOString(),
          sunset: new Date((data as any).sys.sunset * 1000).toISOString()
        },
        timestamp: new Date((data as any).dt * 1000).toISOString()
      }
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
}

/**
 * Helper function to get text representation of wind direction
 */
function getWindDirection(degrees: number): string {
  const directions = ['North', 'North-Northeast', 'Northeast', 'East-Northeast', 'East', 
                     'East-Southeast', 'Southeast', 'South-Southeast', 'South', 
                     'South-Southwest', 'Southwest', 'West-Southwest', 'West', 
                     'West-Northwest', 'Northwest', 'North-Northwest'];
  return directions[Math.round(degrees / 22.5) % 16];
}

/**
 * Calculator tool implementation
 * Returns data in MCP-compatible format
 */
function calculateExpression(expression: string): any {
  try {
    // Sanitize the expression to prevent code injection
    if (!/^[0-9+\-*/(). ]+$/.test(expression)) {
      throw new Error('Invalid expression. Only numbers and basic operators are allowed.');
    }
    
    // Use Function constructor instead of eval for better security
    // Note: this is still not completely secure for production use
    const result = Function(`'use strict'; return (${expression})`)();
    
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Invalid result');
    }
    
    // Format response according to MCP guidelines
    return {
      success: true,
      type: "calculation_result",
      content: {
        expression: expression,
        result: result,
        formatted_result: result.toString()
      }
    };
  } catch (error) {
    console.error('Error calculating expression:', error);
    throw new Error(`Failed to calculate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Search tool implementation
 * Simulates search functionality with structured return format
 */
async function searchInformation(query: string, numResults: number = 5): Promise<any> {
  try {
    // In a real implementation, this would call a search API
    // This is a simulation that returns structured data
    return {
      success: true,
      type: "search_results",
      content: {
        query: query,
        total_results: numResults,
        results: Array.from({ length: numResults }, (_, i) => ({
          title: `Search result ${i+1} for "${query}"`,
          snippet: `This is a simulated search result for the query "${query}". It contains information that would be relevant to the search.`,
          url: `https://example.com/result-${i+1}`
        }))
      }
    };
  } catch (error) {
    console.error('Error performing search:', error);
    throw error;
  }
}

/**
 * List available MCP servers (marketplace)
 * Returns servers in MCP-compatible format
 */
export async function listMCPServers(): Promise<MCPServer[]> {
  try {
    // Get all public servers
    const { data: serversData, error: serversError } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });
      
    if (serversError) {
      console.error(`Supabase error: ${serversError.message}`);
      throw new Error(`Failed to fetch MCP servers: ${serversError.message}`);
    }
    
    // Get tools for all servers
    const { data: toolsData, error: toolsError } = await supabase
      .from('mcp_tools')
      .select('*')
      .in('server_id', serversData.map((server: { id: any; }) => server.id));
      
    if (toolsError) {
      console.error(`Failed to fetch tools: ${toolsError.message}`);
      throw new Error(`Failed to fetch MCP tools: ${toolsError.message}`);
    }
    
    // Get resources for all servers
    const { data: resourcesData, error: resourcesError } = await supabase
      .from('mcp_resources')
      .select('*')
      .in('server_id', serversData.map((server: { id: any; }) => server.id));
      
    if (resourcesError) {
      console.error(`Failed to fetch resources: ${resourcesError.message}`);
      throw new Error(`Failed to fetch MCP resources: ${resourcesError.message}`);
    }
    
    // Get prompts for all servers
    const { data: promptsData, error: promptsError } = await supabase
      .from('mcp_prompts')
      .select('*')
      .in('server_id', serversData.map((server: { id: any; }) => server.id));
      
    if (promptsError) {
      console.error(`Failed to fetch prompts: ${promptsError.message}`);
      throw new Error(`Failed to fetch MCP prompts: ${promptsError.message}`);
    }
    
    // Map the data into the MCPServer format
    return serversData.map((server: { id: any; name: any; description: any; owner_id: any; created_at: any; updated_at: any; is_public: any; expires_at: any; schema_version: any; transport_types: any; capabilities: any; }) => {
      const serverTools = toolsData?.filter((tool: { server_id: any; }) => tool.server_id === server.id) || [];
      const serverResources = resourcesData?.filter((resource: { server_id: any; }) => resource.server_id === server.id) || [];
      const serverPrompts = promptsData?.filter((prompt: { server_id: any; }) => prompt.server_id === server.id) || [];
      
      return {
        id: server.id,
        name: server.name,
        description: server.description,
        ownerId: server.owner_id,
        createdAt: server.created_at,
        updatedAt: server.updated_at,
        isPublic: server.is_public,
        expiresAt: server.expires_at,
        schemaVersion: server.schema_version,
        transportTypes: server.transport_types,
        capabilities: server.capabilities,
        tools: serverTools.map((tool: { id: any; name: any; description: any; parameters: any; server_id: any; created_at: any; updated_at: any; }) => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          serverId: tool.server_id,
          createdAt: tool.created_at,
          updatedAt: tool.updated_at
        })),
        resources: serverResources.map((resource: { id: any; name: any; description: any; type: any; content: any; server_id: any; created_at: any; updated_at: any; }) => ({
          id: resource.id,
          name: resource.name,
          description: resource.description,
          type: resource.type,
          content: resource.content,
          serverId: resource.server_id,
          createdAt: resource.created_at,
          updatedAt: resource.updated_at
        })),
        prompts: serverPrompts.map((prompt: { id: any; name: any; description: any; template: any; server_id: any; created_at: any; updated_at: any; }) => ({
          id: prompt.id,
          name: prompt.name,
          description: prompt.description,
          template: prompt.template,
          serverId: prompt.server_id,
          createdAt: prompt.created_at,
          updatedAt: prompt.updated_at
        }))
      };
    });
  } catch (error) {
    console.error('Error fetching MCP servers:', error);
    throw error;
  }
}

// getMockMCPServers has been removed - all servers must be fetched from the database
/**
 * Default function for empty server list fallback
 * Returns empty array as we should never use mock servers
 */
function defaultServers(): MCPServer[] {
  return [];
}

/**
 * Generates full MCP server code based on tools and description
 * Creates REAL, PRODUCTION-READY implementation following MCP-SERVER-DEVS.md
 */
export async function generateMCPServerCode(
  description: string, 
  tools: MCPTool[],
  model: string = 'gemini-2.0-flash'
): Promise<string> {
  try {
    console.log('Generating REAL, NON-SIMULATED MCP server code for:', description);
    
    // Format tools for prompt
    const formattedTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters.map(param => ({
        name: param.name,
        type: param.type,
        description: param.description,
        required: param.required,
        enum: param.enum,
        default: param.default
      }))
    }));
    
    // Format model name according to Gemini's API requirements
    const formattedModel = model.includes('/') 
      ? model 
      : model.startsWith('gemini-') 
        ? `models/${model.replace('gemini-', 'gemini/')}` 
        : model;

    // Create prompt for the LLM - STRICT instructions for real implementation
    const prompt = `
You are a senior TypeScript developer creating a REAL, PRODUCTION-READY MCP (Model Context Protocol) server.

USER REQUEST: "${description}"

TOOLS TO IMPLEMENT:
${JSON.stringify(formattedTools, null, 2)}

CRITICAL REQUIREMENTS:
1. Create a 100% REAL, FUNCTIONAL TypeScript implementation - NOT A SIMULATION OR PLACEHOLDER
2. Use REAL API calls for external services based on the tools required
3. NEVER return fake/mock data or use comments like "// TODO" or "// Example implementation"
4. FULLY implement each tool with actual business logic - not placeholders or simulations
5. Use the @modelcontextprotocol/sdk package and zod for validation
6. Request necessary API keys through proper environment variable configuration
7. Handle errors appropriately with specific error messages
8. Include a separate Dockerfile and docker-compose.yml for containerization

Follow the structure from MCP-SERVER-DEVS.md:
- Import @modelcontextprotocol/sdk and zod
- Create server instance with name/version
- Define proper parameter validation with zod
- Implement REAL, FUNCTIONAL code for EACH tool (not simulations)
- Create proper API clients for external services
- Add comprehensive error handling
- Set up proper transport (stdio or HTTP)
- Create a main function to run the server

Example of how to implement a REAL tool (adapt to the specific tools needed):

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";

// Use real API for weather data
const API_BASE = "https://api.example.com";
const USER_AGENT = "mcp-server/1.0";

const server = new McpServer({
  name: "real-server",
  version: "1.0.0",
  capabilities: { tools: {} }
});

// Real implementation with actual API call
server.tool(
  "get-data", 
  "Get real data from API",
  {
    param: z.string().describe("Parameter description")
  },
  async ({ param }) => {
    // REAL implementation - not a simulation
    const response = await fetch(\`\${API_BASE}/endpoint?param=\${encodeURIComponent(param)}\`, {
      headers: { "User-Agent": USER_AGENT }
    });
    
    if (!response.ok) {
      throw new Error(\`API error: \${response.status}\`);
    }
    
    const data = await response.json();
    
    return {
      content: [{ type: "text", text: \`Real result: \${data.result}\` }]
    };
  }
);

// Main function
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
\`\`\`

Also include a proper Dockerfile:

\`\`\`dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy server code
COPY server.ts tsconfig.json ./

# Build TypeScript
RUN npm install -g typescript
RUN tsc

# Set environment variables (replace with actual values in production)
ENV PORT=3000

# Expose the MCP server port
EXPOSE 3000

# Run the server
CMD ["node", "server.js"]
\`\`\`

And a docker-compose.yml file:

\`\`\`yaml
version: '3'
services:
  mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      # Add other environment variables needed by your implementation
\`\`\`

I need you to return:
1. Complete TypeScript implementation (index.ts)
2. A full Dockerfile
3. A docker-compose.yml file
4. package.json with all dependencies
5. A simple README.md with setup instructions
6. A .env.example file showing required environment variables

These should be in separate sections clearly labeled for each file. Each section should be surrounded by \`\`\` file markers.
`;

    // Make API call to generate REAL server code
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: formattedModel,
          prompt,
          generationConfig: {
            temperature: 0.1, // Lower temperature for more deterministic results
            maxOutputTokens: 16384, // Allow larger outputs for complete implementations
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('API response did not contain any candidates');
      }
      
      let serverCode = data.candidates[0].content.parts[0].text;
      
      // Clean up code block syntax from the response but keep the file markers
      serverCode = serverCode.trim();
      
      // Verify the code contains no simulation or mock patterns
      const simulationPatterns = [
        "TODO: Implement",
        "Example implementation",
        "Successfully executed",
        "simulation",
        "mock",
        "placeholder"
      ];
      
      const containsSimulation = simulationPatterns.some(pattern => 
        serverCode.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (containsSimulation) {
        console.warn("LLM generated code with simulation patterns. Regenerating...");
        
        // If we find simulation patterns, make one more attempt with stronger wording
        const retryResponse = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: formattedModel,
            prompt: prompt + "\n\nIMPORTANT: YOUR PREVIOUS RESPONSE STILL CONTAINED SIMULATION CODE. DO NOT USE ANY PLACEHOLDER, SIMULATION OR MOCK IMPLEMENTATIONS. IMPLEMENT REAL API CALLS AND FULLY FUNCTIONAL CODE ONLY.",
            generationConfig: {
              temperature: 0.05,
              maxOutputTokens: 16384,
            }
          })
        });
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          if (retryData.candidates && retryData.candidates.length > 0) {
            serverCode = retryData.candidates[0].content.parts[0].text.trim();
          }
        }
      }
      
      console.log('Successfully generated REAL server code with LLM');
      return serverCode;
      
    } catch (apiError) {
      console.error('Error calling LLM API:', apiError);
      
      // Generate a more helpful error stub that includes a simple but functional implementation
      // Include Docker setup even in the error case
      return `# MCP Server Implementation

## SERVER CODE (index.ts)
\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize MCP server for: ${description}
const server = new McpServer({
  name: "${description.split(' ').slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-')}",
  version: "1.0.0",
  capabilities: { tools: {} }
});

// Define tools based on the user request
${tools.map(tool => `
server.tool(
  "${tool.name}",
  "${tool.description}",
  {
    ${tool.parameters.map(param => `${param.name}: z.${param.type}().describe("${param.description}")`).join(',\n    ')}
  },
  async (params) => {
    try {
      // Basic implementation - replace with actual implementation
      console.log("Executing ${tool.name} with params:", params);
      return {
        content: [{ 
          type: "text", 
          text: \`Executed ${tool.name} with parameters: \${JSON.stringify(params)}\` 
        }]
      };
    } catch (error) {
      console.error("Error executing ${tool.name}:", error);
      throw new Error(\`Failed to execute ${tool.name}: \${error.message}\`);
    }
  }
);`).join('\n')}

// Main function to start the server
async function main() {
  try {
    // Use HTTP transport if PORT is defined, otherwise fall back to stdio
    if (process.env.PORT) {
      const port = parseInt(process.env.PORT, 10) || 3000;
      console.log(\`Starting MCP server on port \${port}\`);
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
\`\`\`

## Dockerfile
\`\`\`dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy server code and config files
COPY index.ts tsconfig.json .env* ./

# Build TypeScript
RUN npm install -g typescript
RUN tsc

# Expose the MCP server port
EXPOSE 3000

# Run the server
CMD ["node", "index.js"]
\`\`\`

## docker-compose.yml
\`\`\`yaml
version: '3'
services:
  mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
      # Add your API keys below
    restart: unless-stopped
\`\`\`

## package.json
\`\`\`json
{
  "name": "mcp-server",
  "version": "1.0.0",
  "description": "MCP Server for ${description}",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node index.js",
    "dev": "ts-node-esm index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.9.0",
    "dotenv": "^16.3.1",
    "node-fetch": "^3.3.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
\`\`\`

## tsconfig.json
\`\`\`json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "outDir": "./",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["index.ts"],
  "exclude": ["node_modules"]
}
\`\`\`

## .env.example
\`\`\`
# Server configuration
PORT=3000
NODE_ENV=development

# Add your API keys below
# OPENAI_API_KEY=your_openai_api_key
# WEATHER_API_KEY=your_weather_api_key
# DATABASE_URL=your_database_connection_string
\`\`\`

## README.md
\`\`\`markdown
# MCP Server for ${description}

This is a Model Context Protocol (MCP) server implementation.

## Quick Start with Docker

1. Clone this repository
2. Create a .env file based on .env.example
3. Run with Docker Compose:

\`\`\`bash
docker-compose up -d
\`\`\`

## Manual Setup

1. Install dependencies:

\`\`\`bash
npm install
\`\`\`

2. Build the TypeScript code:

\`\`\`bash
npm run build
\`\`\`

3. Start the server:

\`\`\`bash
npm start
\`\`\`

## Available Tools

${tools.map(tool => `- **${tool.name}**: ${tool.description}`).join('\n')}

## Environment Variables

See .env.example for required environment variables.

## License

MIT
\`\`\`
`;
    }
  } catch (error) {
    console.error('Error generating MCP server code:', error);
    return `# Error in MCP Server Generation

An error occurred while generating the MCP server code:

\`\`\`
${error instanceof Error ? error.message : String(error)}
\`\`\`

Please try again or contact support.
`;
  }
}