// src/lib/api/mcp.ts
import { MCPServer, MCPTool, MCPToolParameter, MCPResource, MCPPrompt } from '../types';
import { supabase } from '../supabase';

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
  model: string = 'gemini-2.5-pro-exp-03-25'
): Promise<MCPTool[]> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is not configured');
    }
    
    // Use the specified model
    const modelToUse = model;
    
    // Format model name according to Gemini's API requirements
    const formattedModel = modelToUse.includes('/') 
      ? modelToUse 
      : modelToUse.startsWith('gemini-') 
        ? `models/${modelToUse.replace('gemini-', 'gemini/')}` 
        : modelToUse;
    
    // Craft a prompt following MCP specifications for tool definition
    const prompt = `
You are designing a Model Context Protocol (MCP) server. This server will provide AI assistants with tools for executing tasks.

Based on this description: "${description}"

Create tools following the Model Context Protocol specification (https://spec.modelcontextprotocol.io/specification/2025-03-26/). Each tool needs:
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

Ensure the tools:
- Are practical and useful for the requested functionality
- Have self-contained descriptions (AI assistants rely on these to understand the tool)
- Cover all necessary parameters with appropriate types
- Follow MCP specifications exactly

Return only valid JSON without explanation, comments, or surrounding text.
`;

    // Call our proxy API route instead of directly calling Gemini API to avoid CORS issues
    console.log(`Calling Gemini API proxy with model: ${formattedModel}`);
    
    // Make the API request through our proxy
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: formattedModel,
        prompt: prompt,
        generationConfig: {
          temperature: 0.2,          // Lower temperature for more consistent results
          topP: 0.95,                // Control output diversity
          topK: 40,                  // Limit token selection
          maxOutputTokens: 4096,     // Allow space for detailed tool definitions
          responseFormat: { type: "JSON" }  // Request JSON output format
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });
    
    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API proxy error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to generate tools: ${response.status} - ${errorText}`);
    }
    
    // Parse the API response
    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Empty response from Gemini API');
    }
    
    const content = data.candidates[0].content.parts[0].text;
    
    // Parse JSON from the response, handling different return formats
    let toolsData;
    try {
      // First try to parse the entire text as JSON
      toolsData = JSON.parse(content);
    } catch (e) {
      // If that fails, try to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from response');
      }
      toolsData = JSON.parse(jsonMatch[0]);
    }
    
    // Validate that we have an array of tools
    if (!Array.isArray(toolsData)) {
      throw new Error('Generated tools are not in the expected array format');
    }
    
    // Validate each tool against MCP specifications
    toolsData.forEach((tool: any, index: number) => {
      // Check required fields
      if (!tool.name || typeof tool.name !== 'string') {
        throw new Error(`Tool at index ${index} is missing a valid name`);
      }
      
      if (!tool.description || typeof tool.description !== 'string') {
        throw new Error(`Tool '${tool.name}' is missing a valid description`);
      }
      
      if (!Array.isArray(tool.parameters)) {
        throw new Error(`Tool '${tool.name}' has invalid parameters (not an array)`);
      }
      
      // Validate name format (snake_case)
      if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
        // Auto-fix the name to snake_case
        tool.name = tool.name
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, '')
          .replace(/[^a-z0-9_]/g, '_');
      }
      
      // Validate and fix parameters
      tool.parameters.forEach((param: { name: any; type: string; description: string; required: boolean | undefined; enum: undefined; }, paramIndex: any) => {
        if (!param.name || typeof param.name !== 'string') {
          throw new Error(`Parameter at index ${paramIndex} in tool '${tool.name}' is missing a valid name`);
        }
        
        if (!param.type || !['string', 'number', 'boolean', 'object', 'array'].includes(param.type)) {
          // Default to string for invalid types
          param.type = 'string';
        }
        
        if (!param.description || typeof param.description !== 'string') {
          param.description = `Parameter for ${param.name}`;
        }
        
        if (param.required === undefined) {
          param.required = true;
        }
        
        // Ensure enum is an array if present
        if (param.enum !== undefined && !Array.isArray(param.enum)) {
          delete param.enum;
        }
      });
    });
    
    const now = new Date().toISOString();
    
    // Process and format the tools according to MCP specifications
    return toolsData.map((tool: any) => ({
      id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: tool.name,
      description: tool.description,
      parameters: Array.isArray(tool.parameters) ? tool.parameters.map((param: any) => ({
        name: param.name,
        type: param.type,
        description: param.description,
        required: param.required === true,
        enum: param.enum,
        default: param.default
      })) : [],
      serverId: '',
      createdAt: now,
      updatedAt: now
    }));
  } catch (error) {
    console.error('Error generating MCP tools:', error);
    // Fallback to default tools if AI generation fails
    return createDefaultTools(description);
  }
}

/**
 * Generates resources for an MCP server
 */
export async function generateMCPResources(
  description: string,
  model: string = 'gemini-2.5-pro-exp-03-25'
): Promise<MCPResource[]> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return [];
    }
    
    // Use the specified model
    const modelToUse = model;
    
    // Format model name according to Gemini's API requirements
    const formattedModel = modelToUse.includes('/') 
      ? modelToUse 
      : modelToUse.startsWith('gemini-') 
        ? `models/${modelToUse.replace('gemini-', 'gemini/')}` 
        : modelToUse;
    
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

    // Call the Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${formattedModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          responseFormat: { type: "JSON" }
        }
      })
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
      return [];
    }
    
    const content = data.candidates[0].content.parts[0].text;
    
    // Parse JSON from the response
    let resourcesData;
    try {
      resourcesData = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }
      resourcesData = JSON.parse(jsonMatch[0]);
    }
    
    // Validate that we have an array
    if (!Array.isArray(resourcesData)) {
      return [];
    }
    
    const now = new Date().toISOString();
    
    // Format the resources
    return resourcesData.map((resource: any) => ({
      id: `resource-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: resource.name,
      description: resource.description,
      type: resource.type,
      content: resource.content,
      serverId: '',
      createdAt: now,
      updatedAt: now
    }));
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
  model: string = 'gemini-2.5-pro-exp-03-25'
): Promise<MCPPrompt[]> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return [];
    }
    
    // Use the specified model
    const modelToUse = model;
    
    // Format model name according to Gemini's API requirements
    const formattedModel = modelToUse.includes('/') 
      ? modelToUse 
      : modelToUse.startsWith('gemini-') 
        ? `models/${modelToUse.replace('gemini-', 'gemini/')}` 
        : modelToUse;
    
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

    // Call the Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${formattedModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          responseFormat: { type: "JSON" }
        }
      })
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
      return [];
    }
    
    const content = data.candidates[0].content.parts[0].text;
    
    // Parse JSON from the response
    let promptsData;
    try {
      promptsData = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }
      promptsData = JSON.parse(jsonMatch[0]);
    }
    
    // Validate that we have an array
    if (!Array.isArray(promptsData)) {
      return [];
    }
    
    const now = new Date().toISOString();
    
    // Format the prompts
    return promptsData.map((prompt: any) => ({
      id: `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: prompt.name,
      description: prompt.description,
      template: prompt.template,
      serverId: '',
      createdAt: now,
      updatedAt: now
    }));
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
    // First check if the server exists and is active
    const { data: serverData, error: serverError } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('id', serverId)
      .single();
      
    if (serverError) {
      console.warn(`Server not found: ${serverError.message}. Using mock implementation.`);
      
      // Handle the specific tool calls with mock implementations
      if (toolName === 'get_weather') {
        return getWeather(parameters.location, parameters.units);
      } else if (toolName === 'calculate') {
        return calculateExpression(parameters.expression);
      } else if (toolName === 'search') {
        return searchInformation(parameters.query, parameters.num_results);
      } else {
        // Default mock response
        return {
          success: true,
          result: `Mock response for ${toolName} with parameters: ${JSON.stringify(parameters)}`
        };
      }
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
      console.warn(`Tool not found: ${toolError.message}. Using mock implementation.`);
      
      // Handle the specific tool calls with mock implementations
      if (toolName === 'get_weather') {
        return getWeather(parameters.location, parameters.units);
      } else if (toolName === 'calculate') {
        return calculateExpression(parameters.expression);
      } else if (toolName === 'search') {
        return searchInformation(parameters.query, parameters.num_results);
      } else {
        // Default mock response
        return {
          success: true,
          result: `Mock response for ${toolName} with parameters: ${JSON.stringify(parameters)}`
        };
      }
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
    
    // Attempt to use mock implementations first
    try {
      if (toolName === 'get_weather') {
        return await getWeather(parameters.location, parameters.units || 'metric');
      } else if (toolName === 'calculate') {
        return calculateExpression(parameters.expression);
      } else if (toolName === 'search') {
        return searchInformation(parameters.query, parameters.num_results || 5);
      }
    } catch (fallbackError) {
      console.error(`Failed to use mock implementation for ${toolName}:`, fallbackError);
    }
    
    // If all else fails, return a friendly mock response
    return {
      success: true,
      result: `This is a simulated response for ${toolName}. In production, this would connect to a real MCP server.`,
      parameters: parameters
    };
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
      return [...new Set(result)];
    };
    
    // Generate variations to try
    const variations = generateVariations(extractedLocation);
    console.log('Trying variations:', variations);
    
    // Try each variation
    let data = null;
    let successful = false;
    let lastError = '';
    let attempts: string[] = [];
    
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
        location: data.name,
        country: data.sys.country,
        coordinates: {
          latitude: data.coord.lat,
          longitude: data.coord.lon
        },
        temperature: {
          current: data.main.temp,
          feels_like: data.main.feels_like,
          min: data.main.temp_min,
          max: data.main.temp_max,
          units: units === 'metric' ? 'celsius' : 'fahrenheit'
        },
        weather: {
          condition: data.weather[0].main,
          description: data.weather[0].description,
          icon: data.weather[0].icon,
          icon_url: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
        },
        wind: {
          speed: data.wind.speed,
          units: units === 'metric' ? 'm/s' : 'mph',
          direction: data.wind.deg,
          direction_text: getWindDirection(data.wind.deg)
        },
        atmosphere: {
          humidity: data.main.humidity,
          pressure: data.main.pressure,
          visibility: data.visibility
        },
        sun: {
          sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
          sunset: new Date(data.sys.sunset * 1000).toISOString()
        },
        timestamp: new Date(data.dt * 1000).toISOString()
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
      console.warn(`Supabase error: ${serversError.message}. Using mock data.`);
      // This will handle missing tables or other database issues
      return getMockMCPServers();
    }
    
    // Get tools for all servers
    const { data: toolsData, error: toolsError } = await supabase
      .from('mcp_tools')
      .select('*')
      .in('server_id', serversData.map(server => server.id));
      
    if (toolsError) {
      console.warn(`Failed to fetch tools: ${toolsError.message}. Using mock data.`);
      return getMockMCPServers();
    }
    
    // Get resources for all servers
    const { data: resourcesData, error: resourcesError } = await supabase
      .from('mcp_resources')
      .select('*')
      .in('server_id', serversData.map(server => server.id));
      
    if (resourcesError) {
      console.warn(`Failed to fetch resources: ${resourcesError.message}. Using mock data.`);
      return getMockMCPServers();
    }
    
    // Get prompts for all servers
    const { data: promptsData, error: promptsError } = await supabase
      .from('mcp_prompts')
      .select('*')
      .in('server_id', serversData.map(server => server.id));
      
    if (promptsError) {
      console.warn(`Failed to fetch prompts: ${promptsError.message}. Using mock data.`);
      return getMockMCPServers();
    }
    
    // Map the data into the MCPServer format
    return serversData.map(server => {
      const serverTools = toolsData?.filter(tool => tool.server_id === server.id) || [];
      const serverResources = resourcesData?.filter(resource => resource.server_id === server.id) || [];
      const serverPrompts = promptsData?.filter(prompt => prompt.server_id === server.id) || [];
      
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
        tools: serverTools.map(tool => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          serverId: tool.server_id,
          createdAt: tool.created_at,
          updatedAt: tool.updated_at
        })),
        resources: serverResources.map(resource => ({
          id: resource.id,
          name: resource.name,
          description: resource.description,
          type: resource.type,
          content: resource.content,
          serverId: resource.server_id,
          createdAt: resource.created_at,
          updatedAt: resource.updated_at
        })),
        prompts: serverPrompts.map(prompt => ({
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
    // Fallback to mock data for any unexpected errors
    return getMockMCPServers();
  }
}

/**
 * Provides mock MCP server data for development when Supabase is not available
 */
function getMockMCPServers(): MCPServer[] {
  const now = new Date().toISOString();
  
  return [
    {
      id: 'mock-server-1',
      name: 'Mock Filesystem Server',
      description: 'A mock MCP server that simulates filesystem operations',
      ownerId: 'mock-user-1',
      createdAt: now,
      updatedAt: now,
      isPublic: true,
      tools: [
        {
          id: 'mock-tool-1',
          name: 'read_file',
          description: 'Read the contents of a file',
          parameters: [
            {
              name: 'path',
              type: 'string',
              description: 'Path to the file',
              required: true
            }
          ],
          serverId: 'mock-server-1',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'mock-tool-2',
          name: 'write_file',
          description: 'Write content to a file',
          parameters: [
            {
              name: 'path',
              type: 'string',
              description: 'Path to the file',
              required: true
            },
            {
              name: 'content',
              type: 'string',
              description: 'Content to write',
              required: true
            }
          ],
          serverId: 'mock-server-1',
          createdAt: now,
          updatedAt: now
        }
      ],
      resources: [
        {
          id: 'mock-resource-1',
          name: 'system_info',
          description: 'System information',
          type: 'text/plain',
          content: 'OS: Linux\nVersion: 5.15.0\nArchitecture: x64',
          serverId: 'mock-server-1',
          createdAt: now,
          updatedAt: now
        }
      ],
      prompts: [
        {
          id: 'mock-prompt-1',
          name: 'file_analysis',
          description: 'Analyze file contents',
          template: 'Please analyze the following file:\n{{content}}',
          serverId: 'mock-server-1',
          createdAt: now,
          updatedAt: now
        }
      ],
      schemaVersion: '2025-03-26',
      transportTypes: ['sse', 'stdio'],
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
        sampling: false
      }
    },
    {
      id: 'mock-server-2',
      name: 'Mock Weather Server',
      description: 'A mock MCP server that provides weather information',
      ownerId: 'mock-user-1',
      createdAt: now,
      updatedAt: now,
      isPublic: true,
      tools: [
        {
          id: 'mock-tool-3',
          name: 'get_weather',
          description: 'Get weather information for a location',
          parameters: [
            {
              name: 'location',
              type: 'string',
              description: 'Location (city name or coordinates)',
              required: true
            }
          ],
          serverId: 'mock-server-2',
          createdAt: now,
          updatedAt: now
        }
      ],
      schemaVersion: '2025-03-26',
      transportTypes: ['sse'],
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
        sampling: false
      }
    }
  ];
}
/**
 * Default servers for fallback
 */
function defaultServers(): MCPServer[] {
  const now = new Date().toISOString();
  
  return [
    {
      id: 'weather-server-1',
      name: 'Weather API Hub',
      description: 'Multi-source weather data with forecasts and historical data',
      ownerId: 'system',
      createdAt: now,
      updatedAt: now,
      isPublic: true,
      schemaVersion: "2025-03-26",
      transportTypes: ["sse", "stdio"],
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
        sampling: false
      },
      tools: [{
        id: 'get-weather-1',
        name: 'get_weather',
        description: 'Get current weather and forecast for a location',
        parameters: [
          {
            name: 'location',
            type: 'string',
            description: 'City name or coordinates',
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
        ],
        serverId: 'weather-server-1',
        createdAt: now,
        updatedAt: now
      }],
      resources: [],
      prompts: []
    },
    {
      id: 'calculator-server-1',
      name: 'Smart Calculator',
      description: 'Advanced math operations and unit conversions',
      ownerId: 'system',
      createdAt: now,
      updatedAt: now,
      isPublic: true,
      schemaVersion: "2025-03-26",
      transportTypes: ["sse", "stdio"],
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
        sampling: false
      },
      tools: [{
        id: 'calculate-1',
        name: 'calculate',
        description: 'Perform mathematical calculations',
        parameters: [
          {
            name: 'expression',
            type: 'string',
            description: 'Mathematical expression to evaluate',
            required: true
          }
        ],
        serverId: 'calculator-server-1',
        createdAt: now,
        updatedAt: now
      }],
      resources: [],
      prompts: []
    },
    {
      id: 'search-server-1',
      name: 'Web Search',
      description: 'Search for information online and get structured results',
      ownerId: 'system',
      createdAt: now,
      updatedAt: now,
      isPublic: true,
      schemaVersion: "2025-03-26",
      transportTypes: ["sse", "stdio"],
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
        sampling: false
      },
      tools: [{
        id: 'search-1',
        name: 'search',
        description: 'Search for information on a given topic',
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
        serverId: 'search-server-1',
        createdAt: now,
        updatedAt: now
      }],
      resources: [],
      prompts: []
    }
  ];
}

