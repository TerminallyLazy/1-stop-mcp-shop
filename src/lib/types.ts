// MCP Server types
export interface MCPServer {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  expiresAt?: string; // For non-premium users
  tools: MCPTool[];
}

export interface MCPTool {
  id: string;
  name: string;
  description: string;
  parameters: MCPToolParameter[];
  serverId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MCPToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  enum?: string[];
  default?: any;
}

// User types
export interface User {
  id: string;
  email: string;
  subscription: 'free' | 'premium';
  createdAt: string;
}

// MCP Client types
export interface MCPClientConfig {
  servers: Record<string, {
    url: string;
    name: string;
  }>;
}

// LLM Provider types
export interface LLMProvider {
  id: 'gemini' | 'openrouter';
  name: string;
  models: LLMModel[];
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  createdAt: string;
}

export interface ToolCall {
  id: string;
  tool: string;
  args: Record<string, any>;
  status: 'pending' | 'success' | 'error';
  result?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
