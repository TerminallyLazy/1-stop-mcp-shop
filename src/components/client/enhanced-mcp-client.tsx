import { useState, useEffect, useRef, AwaitedReactNode, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal, SetStateAction } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { callGeminiAPI } from "../../lib/api/gemini";
import { callOpenRouterAPI } from "../../lib/api/openrouter";
import { callMCPTool } from "../../lib/api/mcp";
import { ChatMessage, MCPServer, ToolCall } from "../../lib/types";
import { listMCPServers } from "../../lib/api/mcp";
import { getUserSession } from "../../lib/supabase";
import { createFollowUpPrompt } from "../../lib/utils/tool-handler";
// import { X } from "lucide-react";



// New component for server details modal
interface ServerDetailsModalProps {
  server: MCPServer | null;
  isOpen: boolean;
  onClose: () => void;
}

function ServerDetailsModal({ server, isOpen, onClose }: ServerDetailsModalProps) {
  if (!server) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-primary/10 p-1 rounded text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.29 7 12 12 20.71 7" />
                <line x1="12" y1="22" x2="12" y2="12" />
              </svg>
            </span>
            {server.name}
          </DialogTitle>
          <DialogDescription>{server.description}</DialogDescription>
        </DialogHeader>
        
        <div className="pt-4">
          <h3 className="text-sm font-medium mb-2">Available Tools ({server.tools.length})</h3>
          <div className="h-[400px] rounded-md border p-4 overflow-y-auto">
            <div className="space-y-4">
              {server.tools.map((tool) => (
                <div key={tool.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">{tool.name}</h4>
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      {tool.parameters.length} params
                    </span>
                  </div>
                  
                  {tool.parameters.length > 0 && (
                    <div className="mt-3">
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">Parameters:</h5>
                      <div className="space-y-2">
                        {tool.parameters.map((param, index) => (
                          <div key={index} className="bg-muted/40 text-sm rounded p-2">
                            <div className="flex justify-between">
                              <span className="font-mono text-xs">{param.name}</span>
                              <div className="flex items-center gap-1">
                                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                                  {param.type}
                                </span>
                                {param.required && (
                                  <span className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                                    required
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs mt-1 text-muted-foreground">{param.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EnhancedMCPClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-pro-exp-03-25");
  const [availableServers, setAvailableServers] = useState<MCPServer[]>([]);
  const [installedServers, setInstalledServers] = useState<MCPServer[]>([]);
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([]);
  const [userSession, setUserSession] = useState<{user: any, subscription?: string}|null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // State for the server details modal
  const [selectedServerForDetails, setSelectedServerForDetails] = useState<MCPServer | null>(null);
  const [isServerDetailsOpen, setIsServerDetailsOpen] = useState(false);

  // Function to show server details
  const showServerDetails = (server: MCPServer) => {
    setSelectedServerForDetails(server);
    setIsServerDetailsOpen(true);
  };
  
  // Function to close server details modal
  const closeServerDetails = () => {
    setIsServerDetailsOpen(false);
  };

  // Fetch user session and available servers
  useEffect(() => {
    const fetchUserAndServers = async () => {
      try {
        // Get user session
        const session = await getUserSession();
        setUserSession(session);
        
        // Fetch available servers
        const servers = await listMCPServers();
        setAvailableServers(servers);
        
        // Get installed servers from local storage
        const storedServers = localStorage.getItem('installedServers');
        if (storedServers) {
          const parsedServers = JSON.parse(storedServers);
          setInstalledServers(parsedServers);
        } else if (servers.length > 0) {
          // If no stored servers, use the first one as default
          setInstalledServers([servers[0]]);
          localStorage.setItem('installedServers', JSON.stringify([servers[0]]));
        }
      } catch (error) {
        console.error("Error initializing client:", error);
      }
    };

    fetchUserAndServers();
  }, []);

  // Scroll to bottom of messages and ensure the chat container doesn't grow beyond screen size
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    // Adjust height dynamically if needed
    const adjustChatHeight = () => {
      const chatContainer = document.querySelector('.chat-container') as HTMLElement;
      if (chatContainer) {
        const viewportHeight = window.innerHeight;
        const navbarHeight = 64; // Approximate navbar height
        const footerHeight = 72; // Approximate card footer height
        const headerHeight = 85; // Approximate card header height
        const maxHeight = viewportHeight - navbarHeight - footerHeight - headerHeight - 40; // Additional padding
        chatContainer.style.maxHeight = `${maxHeight}px`;
      }
    };
    
    adjustChatHeight();
    window.addEventListener('resize', adjustChatHeight);
    
    return () => window.removeEventListener('resize', adjustChatHeight);
  }, [messages]);

  // Helper function to detect tool calls in the assistant response
  // Tool call cache to prevent duplicate API calls within a session
  const toolCallCache = useRef<Map<string, any>>(new Map());
  
  const detectToolCalls = (content: string, servers: MCPServer[]): ToolCall[] => {
    const toolCalls: ToolCall[] = [];
    const uniqueToolRequests = new Set<string>();
    
    // MCP-compliant JSON-RPC 2.0 tool call patterns
    // Match both standard XML tags and code blocks with XML tags
    const jsonRpcPattern = /(?:<mcp:tool_call>|```xml\s*<mcp:tool_call>)\s*([\s\S]*?)\s*(?:<\/mcp:tool_call>|<\/mcp:tool_call>\s*```)/gi;
    
    // First try to find structured MCP tool calls
    let jsonRpcMatch;
    while ((jsonRpcMatch = jsonRpcPattern.exec(content)) !== null) {
      try {
        // Extract the JSON part
        const jsonText = jsonRpcMatch[1]?.trim();
        console.log("Found tool call JSON:", jsonText);
        
        if (jsonText) {
          const toolCallData = JSON.parse(jsonText);
          
          // Validate it follows JSON-RPC 2.0 format
          if (toolCallData.jsonrpc === '2.0' && 
              toolCallData.method === 'execute_tool' && 
              toolCallData.params && 
              toolCallData.params.name) {
            
            const toolName = toolCallData.params.name;
            const parameters = toolCallData.params.parameters || {};
            
            // Create a unique key for this tool call to prevent duplicates
            const toolRequestKey = `${toolName}-${JSON.stringify(parameters)}`;
            
            // Skip if we've already seen this exact tool+parameters combination
            if (uniqueToolRequests.has(toolRequestKey)) {
              console.log(`Skipping duplicate tool call: ${toolRequestKey}`);
              continue;
            }
            
            uniqueToolRequests.add(toolRequestKey);
            
            // Find the server that has this tool
            const serverWithTool = servers.find(server => 
              server.tools.some((tool: { name: any; }) => tool.name === toolName)
            );
            
            if (serverWithTool) {
              toolCalls.push({
                id: toolCallData.id || `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                tool: toolName,
                args: parameters,
                status: 'pending',
                requestKey: toolRequestKey // Add this to track duplicates
              });
            }
          }
        }
      } catch (error) {
        console.error("Error parsing MCP tool call:", error);
      }
    }
    
    // If no structured MCP calls found, fall back to regex pattern matching
    if (toolCalls.length === 0) {
      // Check for common Gemini output patterns like: "tool_name(params)" or "tool_code tool_name(params)"
      // This regex is more flexible to handle Gemini's formatting of tool calls
      const geminiToolPattern = /(?:```(?:tool_code\s+)?|\btool_code\s+)?([a-zA-Z0-9_]+)\s*\(\s*(?:location|query|expression)=(?:"|')([^"']+)(?:"|')\s*\)/gi;
      let geminiMatch;
      
      while ((geminiMatch = geminiToolPattern.exec(content)) !== null) {
        const toolName = geminiMatch[1].trim();
        const paramValue = geminiMatch[2].trim();
        
        // Extract parameter name based on common tools
        let paramName = "query"; // Default
        if (toolName.includes("weather")) {
          paramName = "location";
        } else if (toolName.includes("calculate")) {
          paramName = "expression";
        }
        
        // Find the server that has this tool
        const serverWithTool = servers.find(server => 
          server.tools.some((tool: { name: string; }) => tool.name === toolName || 
                                   tool.name === `get_${toolName}`)
        );
        
        if (serverWithTool) {
          // Find the exact tool
          const exactToolName = serverWithTool.tools.find((t: { name: string; }) => 
            t.name === toolName || t.name === `get_${toolName}`
          )?.name || toolName;
          
          // Add the tool call
          toolCalls.push({
            id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            tool: exactToolName,
            args: { [paramName]: paramValue },
            status: 'pending'
          });
        }
      }
      
      // Check for tool call indicators in the message content with Using tool: format
      const toolCallPattern = /Using tool:?\s+([a-zA-Z0-9_]+)\(([^)]*)\)/gi;
      let match;
      
      while ((match = toolCallPattern.exec(content)) !== null) {
        const toolName = match[1];
        const paramsStr = match[2].trim();
        
        // Find the server that has this tool
        const serverWithTool = servers.find(server => 
          server.tools.some((tool: { name: string; }) => tool.name === toolName)
        );
        
        if (serverWithTool) {
          const tool = serverWithTool.tools.find((t: { name: string; }) => t.name === toolName);
          
          if (tool) {
            // Parse parameters from the string
            const params: Record<string, string> = {};
            if (paramsStr) {
              const paramPairs = paramsStr.split(',');
              for (const pair of paramPairs) {
                const [key, value] = pair.split('=').map(p => p.trim());
                if (key && value) {
                  // Remove quotes if present
                  params[key] = value.replace(/^["'](.*)["']$/, '$1');
                }
              }
            }
            
            // Add the tool call
            toolCalls.push({
              id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              tool: toolName,
              args: params,
              status: 'pending'
            });
          }
        }
      }
    }
    
    // Special handling for specific patterns
    
    // Weather pattern
    if (content.toLowerCase().includes('weather') && servers.some(server => 
      server.tools.some((tool: { name: string | string[]; }) => tool.name.includes('weather') || tool.name.includes('get_weather'))
    )) {
      const weatherServer = servers.find(server => 
        server.tools.some((tool: { name: string | string[]; }) => tool.name.includes('weather') || tool.name.includes('get_weather'))
      );
      
      if (weatherServer) {
        const weatherTool = weatherServer.tools.find((tool: { name: string | string[]; }) => 
          tool.name.includes('weather') || tool.name.includes('get_weather')
        );
        
        if (weatherTool && !toolCalls.some(tc => tc.tool.includes('weather'))) {
          // Extract location from content using proper patterns
          let location = "";
          
          // Try multiple patterns to extract location
          const patterns = [
            /weather\s+(?:in|for|at)\s+([a-zA-Z0-9\s,\-\.]+)/i,
            /(?:in|for|at)\s+([a-zA-Z0-9\s,\-\.]+)(?:\s+weather)/i,
            /what(?:'s|\s+is)\s+(?:the\s+)?weather\s+(?:in|for|at)\s+([a-zA-Z0-9\s,\-\.]+)/i,
            /([a-zA-Z0-9\s,\-\.]+)\s+weather/i
          ];
          
          // Try each pattern until we find a match
          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
              location = match[1].trim();
              break;
            }
          }
          
          // Only proceed if we have a valid location
          if (location) {
            toolCalls.push({
              id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              tool: weatherTool.name,
              args: { location },
              status: 'pending'
            });
          }
        }
      }
    }
    
    // Calculator pattern
    if ((content.toLowerCase().includes('calculate') || content.match(/\d+[\+\-\*\/]\d+/)) && 
        servers.some(server => server.tools.some((tool: { name: string | string[]; }) => tool.name.includes('calculate')))) {
      
      const calcServer = servers.find(server => 
        server.tools.some((tool: { name: string | string[]; }) => tool.name.includes('calculate'))
      );
      
      if (calcServer) {
        const calcTool = calcServer.tools.find((tool: { name: string | string[]; }) => 
          tool.name.includes('calculate')
        );
        
        if (calcTool && !toolCalls.some(tc => tc.tool.includes('calculate'))) {
          // Extract expression from content
          let expression = "";
          
          // Try to find a mathematical expression
          const patterns = [
            /calculate\s+([0-9\+\-\*\/\(\)\s\.]+)/i,
            /compute\s+([0-9\+\-\*\/\(\)\s\.]+)/i,
            /([0-9]+(?:[\+\-\*\/][0-9]+)+)/,
            /([0-9]+\s*[\+\-\*\/]\s*[0-9]+(?:\s*[\+\-\*\/]\s*[0-9]+)*)/
          ];
          
          // Try each pattern
          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
              expression = match[1].trim();
              break;
            }
          }
          
          // Only proceed if we found a valid expression
          if (expression) {
            toolCalls.push({
              id: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              tool: calcTool.name,
              args: { expression },
              status: 'pending'
            });
          }
        }
      }
    }
    
    return toolCalls;
  };

  // Helper function to check if a message is a tool response
  const isToolResponse = (message: ChatMessage) => {
    return message.role === 'tool' || (message.role === 'assistant' && message.content.includes('I used the tool') || message.content.includes('Here\'s what I found'));
  };
  
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    // Check if the user input contains a direct tool call
    const directToolCalls = detectToolCalls(input, installedServers);
    const containsDirectToolCall = directToolCalls.length > 0;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    
    // If the user provided a direct tool call, process it immediately
    if (containsDirectToolCall) {
      console.log('Direct tool call detected:', directToolCalls);
      // Create a system message indicating the direct tool call execution
      const systemMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: 'Executing direct tool call...',
        createdAt: new Date().toISOString(),
        toolCalls: directToolCalls
      };
      
      setMessages(prev => [...prev, systemMessage]);
      setActiveToolCalls(directToolCalls);
      
      // Process each tool call
      for (const toolCall of directToolCalls) {
        try {
          await processToolCall(toolCall, systemMessage.id);
        } catch (error) {
          console.error(`Error processing direct tool call ${toolCall.tool}:`, error);
        }
      }
      
      setIsLoading(false);
      return; // Skip the LLM call for direct tool calls
    }
    
    try {
      // Get available MCP capabilities to instruct the LLM
      const availableTools: string[] = [];
      const availableServers = installedServers.map(server => ({
        name: server.name,
        description: server.description,
        capabilities: server.capabilities || {
          tools: server.tools.length > 0,
          resources: Array.isArray(server.resources) && server.resources.length > 0 ? {
            // Optional subscribe and listChanged features according to spec
            subscribe: false,
            listChanged: false
          } : false,
          prompts: Array.isArray(server.prompts) && server.prompts.length > 0 ? {} : false,
          sampling: false
        },
        tools: server.tools.map((tool: { name: any; description: any; parameters: any; }) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }));
      
      // Create a system message to guide the AI about MCP capabilities
      const systemMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: `You have access to the following MCP (Model Context Protocol) servers and tools:
${availableServers.map(server => `
Server: ${server.name}
Description: ${server.description}
Tools: ${server.tools.map((tool: { name: any; }) => tool.name).join(', ')}

${server.tools.map((tool: { name: any; description: any; parameters: any[]; }) => `Tool: ${tool.name}
Description: ${tool.description}
Parameters: ${tool.parameters.map((p: { name: any; type: any; required: any; }) => `${p.name} (${p.type}${p.required ? ', required' : ''})`).join(', ')}
`).join('\n')}
`).join('\n')}

To use these tools, format your response using the MCP specification:

<mcp:tool_call>
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "execute_tool",
  "params": {
    "name": "tool_name",
    "parameters": {
      "param1": "value1",
      "param2": "value2"
    }
  }
}
</mcp:tool_call>

You can use these tools to retrieve information or take actions for the user. Only use tools that are available based on the list above.
`,
        createdAt: new Date().toISOString()
      };
      
      // Call the appropriate LLM API based on the selected model
      let response;
      if (selectedModel.startsWith('gemini')) {
        // For Gemini, we need a simpler conversation structure
        // Create a new set of messages with the system guidance combined into the user message
        const userInstruction: ChatMessage = {
          id: `gemini-context-${Date.now()}`,
          role: 'user',
          content: `You are a helpful assistant that can have natural conversations with users. You can use tools when appropriate to get information needed to answer questions.

Available tools: ${installedServers.map(server => 
            server.tools.map((tool: { name: any; description: any; }) => `${tool.name} - ${tool.description}`).join(', ')
          ).join('. ')}

When you need to use a tool, format it like this:
<mcp:tool_call>
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "execute_tool",
  "params": {
    "name": "tool_name",
    "parameters": {
      "param1": "value1"
    }
  }
}
</mcp:tool_call>

IMPORTANT: If you can't format exactly like above, you can use: get_weather(location="city_name") 

For example: To check the weather in Seattle, you could use:
get_weather(location="Seattle")

IMPORTANT: After using a tool once, just respond to the information without making additional tool calls. Wait for the user to ask another question before using tools again.

User message: ${userMessage.content}`,
          createdAt: new Date().toISOString()
        };
        
        // Only pass the current message for Gemini to keep things simple
        response = await callGeminiAPI([userInstruction], selectedModel);
      } else if (selectedModel.includes('anthropic') || selectedModel.includes('claude')) {
        // For Anthropic models through OpenRouter, we need special handling
        // They only support 'user' and 'assistant' roles
        
        // Create a simplified user message that includes tool information
        const anthropicUserMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: `You are a helpful assistant with access to tools. Available tools: ${installedServers.map(server => 
            server.tools.map((tool: { name: any; description: any; }) => `${tool.name} - ${tool.description}`).join(', ')
          ).join('. ')}

You can use these tools when needed to help answer questions. Use a format like:
"I'll check that using the get_weather tool"

My question is: ${userMessage.content}`,
          createdAt: new Date().toISOString()
        };
        
        // Get the most recent conversational context (up to 5 messages)
        // Only include user and assistant messages
        const recentContext = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-5)
          .map(m => ({...m})); // Create copies to avoid mutation
        
        // Add the new user message
        response = await callOpenRouterAPI([...recentContext, anthropicUserMessage], selectedModel);
      } else {
        response = await callOpenRouterAPI([...messages, systemMessage, userMessage], selectedModel);
      }
      
      if (response.success && response.message) {
        let assistantMessage = response.message as ChatMessage;
        
        // Check for tool calls in the assistant message using MCP-compliant detection
        const toolCalls = detectToolCalls(assistantMessage.content, installedServers);
        
        if (toolCalls.length > 0) {
          // Extract and remove tool call XML from message content
          let cleanedContent = assistantMessage.content;
          const jsonRpcPattern = /(?:<mcp:tool_call>|```xml\s*<mcp:tool_call>)\s*([\s\S]*?)\s*(?:<\/mcp:tool_call>|<\/mcp:tool_call>\s*```)/gi;
          
          // Find all tool call blocks and remove them from content
          let match;
          while ((match = jsonRpcPattern.exec(assistantMessage.content)) !== null) {
            cleanedContent = cleanedContent.replace(match[0], '');
          }
          
          // Clean up any leftover whitespace or newlines
          cleanedContent = cleanedContent.trim();
          
          // Prepare the assistant message with clean content and tool calls
          assistantMessage = {
            ...assistantMessage,
            content: cleanedContent,
            toolCalls
          };
          
          setActiveToolCalls(toolCalls);
          
          // Add the assistant message with clean content and tool calls
          setMessages(prev => [...prev, assistantMessage]);
          
          // Process only the first tool call to prevent chaining multiple calls
          if (toolCalls.length > 0) {
            await processToolCall(toolCalls[0], assistantMessage.id);
            // Do not process additional tool calls to prevent chaining
          }
        } else {
          // Add the assistant message without tool calls
          setMessages(prev => [...prev, assistantMessage]);
        }
      } else if (response.error) {
        // Handle API error
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `Error: ${response.error}`,
          createdAt: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Add error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
      setActiveToolCalls([]);
    }
  };

  const processToolCall = async (toolCall: ToolCall, assistantMessageId: string) => {
    try {
      console.log(`Processing tool call: ${toolCall.tool}`, toolCall);
      
      // Check if we have a cached result for this exact tool call
      const cacheKey = toolCall.requestKey || `${toolCall.tool}-${JSON.stringify(toolCall.args)}`;
      
      if (toolCallCache.current.has(cacheKey)) {
        console.log(`Using cached result for tool call: ${cacheKey}`);
        const cachedResult = toolCallCache.current.get(cacheKey);
        
        // Update tool call status to success with cached result
        setActiveToolCalls(prev => prev.map(tc => 
          tc.id === toolCall.id ? { ...tc, status: 'success', result: JSON.stringify(cachedResult) } : tc
        ));
        
        // Add tool result message to the conversation
        const formattedCachedResult = typeof cachedResult === 'string' 
          ? cachedResult 
          : JSON.stringify(cachedResult, null, 2);
        
        const toolMessage: ChatMessage = {
          id: `tool-${Date.now()}`,
          role: 'tool',
          content: formattedCachedResult,
          toolCallId: toolCall.id,
          createdAt: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, toolMessage]);
        
        // Always generate a follow-up response for cached results too
        await generateFollowUpResponse(toolCall, cachedResult);
        
        return cachedResult;
      }
      
      // Find the server that has this tool
      const server = installedServers.find(server => 
        server.tools.some((tool: { name: any; }) => tool.name === toolCall.tool)
      );
      
      if (!server) {
        throw new Error(`No server found with tool: ${toolCall.tool}`);
      }
      
      // Update tool call status to in progress
      setActiveToolCalls(prev => prev.map(tc => 
        tc.id === toolCall.id ? { ...tc, status: 'in_progress' } : tc
      ));
      
      console.log(`Calling MCP tool: ${toolCall.tool} with args:`, toolCall.args);
      
      // Call the tool following MCP protocol
      const result = await callMCPTool(server.id, toolCall.tool, toolCall.args);
      
      console.log(`Tool call result for ${toolCall.tool}:`, result);
      
      // Cache the result for future use
      toolCallCache.current.set(cacheKey, result);
      
      // Update the tool call status
      setActiveToolCalls(prev => prev.map(tc => 
        tc.id === toolCall.id ? { ...tc, status: 'success', result: JSON.stringify(result) } : tc
      ));
      
      // Format the response in MCP-compliant format
      const formattedResult = typeof result === 'string' 
        ? result 
        : JSON.stringify(result, null, 2);
      
      // Add tool result message to show in the UI
      const toolMessage: ChatMessage = {
        id: `tool-${Date.now()}`,
        role: 'tool',
        content: formattedResult,
        toolCallId: toolCall.id,
        createdAt: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, toolMessage]);
      
      // Generate a follow-up response only if needed
      if (shouldGenerateFollowUp(toolCall, result)) {
        await generateFollowUpResponse(toolCall, result);
      }
      
      return result;
    } catch (error) {
      console.error(`Error processing tool call ${toolCall.id}:`, error);
      
      // Update the tool call status to error
      setActiveToolCalls(prev => prev.map(tc => 
        tc.id === toolCall.id ? { ...tc, status: 'error', result: `Error: ${error}` } : tc
      ));
      
      // Create JSON-RPC 2.0 error response format
      const jsonRpcError = {
        jsonrpc: '2.0',
        id: toolCall.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : String(error)
        }
      };
      
      // Add error message to show in the UI
      const errorMessage: ChatMessage = {
        id: `tool-error-${Date.now()}`,
        role: 'tool',
        content: `Error calling ${toolCall.tool}: ${error instanceof Error ? error.message : String(error)}`,
        toolCallId: toolCall.id,
        createdAt: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      // Even for errors, generate a follow-up response to explain the error
      try {
        if (shouldGenerateFollowUp(toolCall, { error: error instanceof Error ? error.message : String(error) })) {
          await generateFollowUpResponse(toolCall, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } catch (followUpError) {
        console.error('Error generating follow-up for error:', followUpError);
      }
    }
  };

  // Function to determine if a follow-up response should be generated based on tool call type
  const shouldGenerateFollowUp = (toolCall: ToolCall, result: any) => {
    // Implement any logic to decide if a follow-up is needed
    // This could be based on the tool type, result content, or other factors
    return true; // Always generate follow-up for now, modify as needed
  };

  const generateFollowUpResponse = async (toolCall: ToolCall, result: any) => {
    console.log(`Generating follow-up response for tool call ${toolCall.id} using model ${selectedModel}`);
    
    // Use the current conversation plus the tool result to generate a follow-up
    const currentMessages = [...messages];
    
    // Format the result into a more human-readable form if it's an object
    const formattedResult = typeof result === 'string' 
      ? result 
      : JSON.stringify(result, null, 2);
    
    // Create a tool result message with special handling for different model types
    let toolResultMessage: ChatMessage;
    
    // Special handling for Anthropic models
    if (selectedModel.includes('anthropic') || selectedModel.includes('claude')) {
      // For Anthropic models, we need to use user/assistant roles only
      toolResultMessage = {
        id: `user-tool-result-${Date.now()}`,
        role: 'user', // Use user role instead of tool for Anthropic
        content: `Here's the result from the ${toolCall.tool} tool call:\n\n${formattedResult}\n\nPlease analyze this and respond.`,
        createdAt: new Date().toISOString()
      };
    } else {
      // Standard tool result message for non-Anthropic models
      toolResultMessage = {
        id: `tool-${Date.now()}`,
        role: 'tool',
        content: formattedResult,
        toolCallId: toolCall.id,
        createdAt: new Date().toISOString()
      };
    }
    
    // Create a full message history including the tool result
    const historyWithToolResult = [...currentMessages, toolResultMessage];
    
    try {
      // Create a follow-up prompt based on the model type
      // This will get special handling for Gemini Flash vs other models
      const followUpPrompt = createFollowUpPrompt(toolCall, result, selectedModel);
      
      console.log('Calling LLM API to generate follow-up response');
      
      // Create messages for the follow-up request
      let followUpMessages: ChatMessage[];
      
      if (selectedModel.startsWith('gemini')) {
        // For Gemini, we just use the followUpPrompt as a single message
        // This simplifies the conversation flow for Gemini's requirements
        followUpMessages = [followUpPrompt];
      } else if (selectedModel.includes('anthropic') || selectedModel.includes('claude')) {
        // For Anthropic models, we need a complete reset of the conversation
        // Just use a single message with the tool result and analysis request
        followUpMessages = [
          // Just a single user message with the tool result and request for analysis
          {
            id: `user-follow-up-${Date.now()}`,
            role: 'user',
            content: `I used the ${toolCall.tool} tool and got this result:\n\n${formattedResult}\n\n` +
                     `Please analyze this information and provide a helpful, conversational response. ` +
                     `Include relevant details from the result in your explanation.\n\n` +
                     `IMPORTANT: Do NOT use any tool call syntax in your response. Do NOT use XML tags or ` +
                     `code blocks. Do NOT include any functions like get_weather() or function calls in your response. ` +
                     `Just respond in plain natural language.`,
            createdAt: new Date().toISOString()
          }
        ];
      } else {
        // For other models, we include the tool result and context
        followUpMessages = [...historyWithToolResult, followUpPrompt];
      }
      
      // Call the LLM API to generate a follow-up response
      let response;
      if (selectedModel.startsWith('gemini')) {
        response = await callGeminiAPI(followUpMessages, selectedModel);
      } else if (selectedModel.includes('anthropic') || selectedModel.includes('claude')) {
        // For Anthropic models, ensure we're using a simple conversation with only user/assistant roles
        const simplifiedMessages = followUpMessages.map(msg => ({
          ...msg,
          role: msg.role === 'system' ? 'user' : msg.role
        })).filter(msg => msg.role === 'user' || msg.role === 'assistant');
        
        console.log('Sending simplified messages to Anthropic:', simplifiedMessages);
        response = await callOpenRouterAPI(simplifiedMessages, selectedModel);
      } else {
        response = await callOpenRouterAPI(followUpMessages, selectedModel);
      }
      
      console.log('LLM follow-up response received:', response);
      
      if (response.success && response.message) {
        let followUpMessage = response.message as ChatMessage;
        
        // For Anthropic/Claude models, do extra cleaning to ensure we get natural language
        if (selectedModel.includes('anthropic') || selectedModel.includes('claude')) {
          // Clean any remaining tool call syntax from the content
          let cleanedContent = followUpMessage.content;
          
          // Remove any XML tags
          cleanedContent = cleanedContent.replace(/<[^>]*>/g, '');
          
          // Remove code blocks
          cleanedContent = cleanedContent.replace(/```[\s\S]*?```/g, '');
          
          // Remove function-style calls
          cleanedContent = cleanedContent.replace(/\b(get_weather|calculate|search)\s*\(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*["'][^"']*["']\s*\)/g, '');
          
          // Remove tool call indicator phrases
          cleanedContent = cleanedContent.replace(/\b(Using tool:|Tool call:|I'll use the|Let me use)\s+[a-zA-Z0-9_]+\s+tool\b.*$/gm, '');
          
          // Clean up extra whitespace
          cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n').trim();
          
          // Update the message with cleaned content
          followUpMessage = {
            ...followUpMessage,
            content: cleanedContent || "Here's the information you requested."
          };
        }
        
        // For Gemini Flash especially, aggressively remove any tool call patterns
        // to prevent chaining of multiple tool calls
        let cleanedContent = followUpMessage.content;
        
        if (selectedModel.includes('flash')) {
          // Remove any XML-style tool calls
          const xmlPattern = /<[^>]*>/g;
          cleanedContent = cleanedContent.replace(xmlPattern, '');
          
          // Remove code blocks that might contain tool calls
          const codeBlockPattern = /```[\s\S]*?```/g;
          cleanedContent = cleanedContent.replace(codeBlockPattern, '');
          
          // Remove any function-style calls like tool_name(param="value")
          const funcPattern = /\w+\s*\([^)]*\)/g;
          cleanedContent = cleanedContent.replace(funcPattern, '');
          
          // Clean up any leftover whitespace or multiple newlines
          cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n').trim();
          
          // Update the message with cleaned content
          followUpMessage.content = cleanedContent;
        }
        
        // Check if the follow-up message contains tool calls (for non-flash models)
        const toolCalls = detectToolCalls(followUpMessage.content, installedServers);
        
        if (toolCalls.length > 0 && !selectedModel.includes('flash')) {
          // Extract and remove tool call XML from message content
          let cleanedContent = followUpMessage.content;
          const jsonRpcPattern = /(?:<mcp:tool_call>|```xml\s*<mcp:tool_call>)\s*([\s\S]*?)\s*(?:<\/mcp:tool_call>|<\/mcp:tool_call>\s*```)/gi;
          
          // Find all tool call blocks and remove them from content
          let match;
          while ((match = jsonRpcPattern.exec(followUpMessage.content)) !== null) {
            cleanedContent = cleanedContent.replace(match[0], '');
          }
          
          // Clean up any leftover whitespace or newlines
          cleanedContent = cleanedContent.trim();
          
          // Add tool calls to the follow-up message with clean content
          const enhancedFollowUpMessage = {
            ...followUpMessage,
            content: cleanedContent,
            toolCalls
          };
          
          // Add the enhanced follow-up message to the conversation
          setMessages(prev => [...prev, enhancedFollowUpMessage]);
          
          // We don't want to process any tool calls in the follow-up response
          // Instead, we'll just show the message with the tool calls detected
          // The user will need to send a new message to trigger more tool calls
          setActiveToolCalls([]);
          // Do not process any follow-up tool calls to prevent chaining
        } else {
          // Add the follow-up message without tool calls
          console.log('Adding follow-up message to conversation');
          setMessages(prev => [...prev, followUpMessage]);
        }
      } else if (response.error) {
        console.error('Error in LLM response:', response.error);
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("Error generating follow-up response:", error);
      // Add a conversational fallback message if the LLM call fails
      const fallbackFollowUp: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: toolCall.tool === 'get_weather' && typeof result === 'object' && result.content 
          ? `I checked the weather for you. It's currently ${result.content.temperature?.current || 'unknown'}° in ${result.content.location || 'the requested location'} with ${result.content.weather?.description || 'current conditions'}. The humidity is ${result.content.atmosphere?.humidity || 'unknown'}% and wind speed is ${result.content.wind?.speed || 'unknown'} ${result.content.wind?.units || 'units'}.`
          : `I've found the information you requested about ${toolCall.tool.replace('get_', '')}. Let me know if you need any other details.`,
        createdAt: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, fallbackFollowUp]);
    }
  };

  const handleInstallServer = (server: MCPServer) => {
    // Add the server to installed servers
    setInstalledServers(prev => {
      // Check if already installed
      if (prev.some(s => s.id === server.id)) {
        return prev;
      }
      
      const newInstalledServers = [...prev, server];
      // Save to local storage
      localStorage.setItem('installedServers', JSON.stringify(newInstalledServers));
      
      return newInstalledServers;
    });
    
    setShowServerDialog(false);
  };

  const handleRemoveServer = (serverId: string) => {
    setInstalledServers(prev => {
      const newInstalledServers = prev.filter(server => server.id !== serverId);
      // Save to local storage
      localStorage.setItem('installedServers', JSON.stringify(newInstalledServers));
      
      return newInstalledServers;
    });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">MCP Servers</CardTitle>
              <CardDescription>
                Connected servers extend AI capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {installedServers.map(server => (
                  <Button 
                    key={server.id}
                    variant="outline" 
                    className="w-full justify-between group hover:border-primary/50"
                    onClick={() => showServerDetails(server)}
                  >
                    <div className="text-left">
                      <div className="font-medium flex items-center">
                        {server.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {server.tools.length} tools
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      Details
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowServerDialog(true)}
              >
                Add Server
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Models</CardTitle>
              <CardDescription>
                Select an LLM to use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="gemini" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="gemini">Gemini</TabsTrigger>
                  <TabsTrigger value="openrouter">OpenRouter</TabsTrigger>
                </TabsList>
                <TabsContent value="gemini" className="space-y-2 mt-2">
                  <Button 
                    variant={selectedModel === "gemini-2.0-flash" ? "default" : "outline"} 
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("gemini-2.0-flash")}
                  >
                    <div className="text-left">
                      <div className="font-medium">Gemini 2.0 Flash</div>
                      <div className="text-xs text-muted-foreground">Google's fastest model</div>
                    </div>
                  </Button>
                  <Button 
                    variant={selectedModel === "gemini-2.5-pro-exp-03-25" ? "default" : "outline"} 
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("gemini-2.5-pro-exp-03-25")}
                  >
                    <div className="text-left">
                      <div className="font-medium">Gemini 2.5 Pro</div>
                      <div className="text-xs text-muted-foreground">Google's most capable model</div>
                    </div>
                  </Button>
                </TabsContent>
                <TabsContent value="openrouter" className="space-y-2 mt-2">
                  <Button 
                    variant={selectedModel === "openai/gpt-4o" ? "default" : "outline"} 
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("openai/gpt-4o")}
                  >
                    <div className="text-left">
                      <div className="font-medium">GPT-4</div>
                      <div className="text-xs text-muted-foreground">Via OpenRouter</div>
                    </div>
                  </Button>
                  <Button 
                    variant={selectedModel === "anthropic/claude-3-sonnet@20240229" ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setSelectedModel("anthropic/claude-3-sonnet@20240229")}
                  >
                    <div className="text-left">
                      <div className="font-medium">Claude 3 Sonnet</div>
                      <div className="text-xs text-muted-foreground">Via OpenRouter</div>
                    </div>
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-3">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>MCP Client</CardTitle>
              <CardDescription>
                 MCP tools
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              <div className="space-y-4 chat-container overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p>Start a conversation with the AI</p>
                    <div className="mt-4 space-y-2">
                      <p className="text-sm">Try asking:</p>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => setInput("What's the weather in Seattle?")}
                      >
                        What's the weather in Seattle?
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => setInput("What's the weather like today?")}
                      >
                        What's the weather like today?
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => setInput("Calculate 42 * 18")}
                      >
                        Calculate 42 * 18
                      </Button>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          message.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : message.role === 'tool'
                              ? 'bg-purple-500/20 text-foreground border border-purple-500/50'
                              : message.role === 'system'
                                ? 'bg-green-500/20 text-foreground border border-green-500/50'
                                : 'bg-muted text-foreground'
                        }`}
                      >
                        {message.role === 'tool' ? (
                          <div>
                            <details className="cursor-pointer">
                              <summary className="flex items-center">
                                <span className="text-xs text-muted-foreground">Tool Result</span>
                                <span className="ml-1 text-xs">▼</span>
                              </summary>
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto font-mono">
                                  {message.content}
                                </pre>
                              </div>
                            </details>
                          </div>
                        ) : message.role === 'assistant' ? (
                          <div>
                            {/* Check if this is a response to a tool that should be cleaned */}
                            {(() => {
                              // Expanded detection of tool call syntax
                              const containsToolSyntax = 
                                message.content.includes('<mcp:tool_call>') ||
                                message.content.includes('get_weather(') ||
                                message.content.includes('calculate(') ||
                                message.content.includes('search(') ||
                                message.content.includes('Tool Result:') ||
                                message.content.includes('```xml') ||
                                message.content.includes('I\'ll use the') ||
                                message.content.includes('Let me use') ||
                                message.content.includes('I will check') ||
                                message.content.includes('Let me check') ||
                                (message.content.match(/```/) && message.content.match(/tool/i)) ||
                                message.content.match(/Using the\s+\w+\s+tool/i);
                              
                              // Models like Claude sometimes still output tool instructions
                              const isAnthropicResponse = selectedModel && 
                                (selectedModel.includes('anthropic') || selectedModel.includes('claude'));
                                
                              // Clean up more aggressively for Anthropic models
                              if (containsToolSyntax || isAnthropicResponse) {
                                let cleanContent = message.content;
                                // Remove all XML blocks
                                cleanContent = cleanContent.replace(/<[^>]*>.*?<\/[^>]*>/g, '');
                                cleanContent = cleanContent.replace(/<[^>]*>/g, '');
                                
                                // Remove code blocks
                                cleanContent = cleanContent.replace(/```[\s\S]*?```/g, '');
                                
                                // Remove function-style calls more aggressively
                                cleanContent = cleanContent.replace(/\b(\w+)\s*\(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*["'][^"']*["']\s*\)/g, '');
                                
                                // Remove tool call indicator phrases - more comprehensive pattern
                                const toolPhrases = [
                                  "I'll use the", "Let me use", "Using the tool", "Using tool:", 
                                  "Tool call:", "I will use", "Let me check", "I can use", 
                                  "To get this information", "To check", "To find", "To calculate"
                                ];
                                
                                toolPhrases.forEach(phrase => {
                                  const regex = new RegExp(`${phrase}[^.]*\\.`, 'gi');
                                  cleanContent = cleanContent.replace(regex, '');
                                });
                                
                                // Clean up excess whitespace
                                cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim();
                                
                                // If the content is now empty after cleaning, use a default message
                                if (!cleanContent || cleanContent.length < 20) {
                                  return <div>Here's the information you requested.</div>;
                                }
                                
                                return <div>{cleanContent}</div>;
                              }
                              // Normal display for responses without tool call syntax
                              return <div>{message.content}</div>;
                            })()}
                            
                            {/* Display tool calls in collapsible sections */}
                            {message.toolCalls && message.toolCalls.length > 0 && (
                              <div className="mt-2">
                                {message.toolCalls.map((toolCall: { id: Key | null | undefined; tool: string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<AwaitedReactNode> | null | undefined; args: any; }) => (
                                  <div key={toolCall.id} className="text-sm">
                                    <details className="cursor-pointer">
                                      <summary className="flex items-center">
                                        <span className="text-xs text-muted-foreground">Tool Call:</span>
                                        <span className="ml-1 font-mono font-semibold text-xs">{toolCall.tool}</span>
                                        <span className="ml-1 text-xs">▼</span>
                                      </summary>
                                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                        {/* Display the tool call as XML */}
                                        <div className="mb-2">
                                          <pre className="text-xs bg-muted rounded p-2 overflow-x-auto font-mono">
{`<mcp:tool_call>
{
  "jsonrpc": "2.0",
  "id": "${toolCall.id}",
  "method": "execute_tool",
  "params": {
    "name": "${toolCall.tool}",
    "parameters": ${JSON.stringify(toolCall.args, null, 2)}
  }
}
</mcp:tool_call>`}
                                          </pre>
                                        </div>
                                        
                                        {/* Display tool arguments */}
                                        <div>
                                          <div className="text-xs text-muted-foreground mb-1">Tool Arguments:</div>
                                          <pre className="text-xs bg-muted rounded p-2 overflow-x-auto font-mono">
                                            {JSON.stringify(toolCall.args, null, 2)}
                                          </pre>
                                        </div>
                                      </div>
                                    </details>
                                  </div>
                                ))}
                              </div>
                            )}
                                

                              </div>
                          ) : (
                          message.content
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted text-foreground">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce"></div>
                        <div className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce delay-75"></div>
                        <div className="w-2 h-2 rounded-full bg-foreground/50 animate-bounce delay-150"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </CardContent>
            <CardFooter>
              <div className="flex w-full items-center space-x-2">
                <Input
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e: { target: { value: SetStateAction<string>; }; }) => setInput(e.target.value)}
                  onKeyDown={(e: { key: string; shiftKey: any; preventDefault: () => void; }) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={isLoading || !input.trim()}
                >
                  Send
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Server Details Modal */}
      <ServerDetailsModal 
        server={selectedServerForDetails} 
        isOpen={isServerDetailsOpen} 
        onClose={closeServerDetails} 
      />
    </div>
  );
}