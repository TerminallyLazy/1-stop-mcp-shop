import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
// Correct the relative path assuming route.ts is in src/app/api/mcp/discover
import { MCPTool } from '../../../../lib/types'; // Corrected path

// Define expected request body structures
interface DiscoverConfigRequest {
  type: 'config';
  config: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
  serverId: string; // For context in logs/errors
}

interface DiscoverUrlRequest {
  type: 'url';
  url: string;
  serverId: string; // For context in logs/errors
}

type DiscoverRequest = DiscoverConfigRequest | DiscoverUrlRequest;

// --- MCP Communication Helpers (Simplified - Needs Robust Implementation) ---

// Function to send MCP request via stdio and get response
async function discoverToolsViaStdio(
  command: string,
  args: string[],
  env: Record<string, string> | undefined
): Promise<MCPTool[]> {
  return new Promise((resolve, reject) => {
    console.log(`Spawning: ${command} ${args.join(' ')}`);
    let childProcess: ChildProcess; // Keep declaration here

    try {
      // Spawn the process
      childProcess = spawn(command, args, {
        env: { ...process.env, ...env }, // env is correctly placed here
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Ensure process and streams are valid *immediately after successful spawn*
      if (!childProcess.stdin || !childProcess.stdout || !childProcess.stderr) {
         // If spawn succeeded but streams are missing, kill and reject
         if (childProcess && !childProcess.killed) childProcess.kill();
         return reject(new Error('Failed to establish stdio streams with spawned process.'));
      }

    } catch (spawnError: any) {
        console.error('Spawn failed immediately:', spawnError);
        // If spawn itself throws, process is not assigned, reject directly
        return reject(new Error(`Failed to spawn server process: ${spawnError.message}`));
    }

    // If we reach here, process is assigned and streams exist.
    let responseData = '';
    let errorData = '';
    let responseTimeout: NodeJS.Timeout | null = null;
    let methodsToTry = []; 
    let currentMethodIndex = 0;

    // Get package information from args
    const packageName = args.find(arg => arg.includes('@')) || '';
    
    // Default methods to try based on MCP protocol specification
    // Listed in order of preference according to MCP standards
    methodsToTry = [
      'tools/list',           // Standard MCP method (preferred)
      'listTools',            // Common camelCase variant
      'list_tools',           // Common snake_case variant
      'ListTools',            // Common PascalCase variant
      'rpc.discover',         // JSON-RPC discovery
      'server.capabilities',  // Server capabilities
      'discovery',            // Generic discovery method
      'getTools',             // Generic getter
      'get_tools',            // Generic snake_case getter
    ];
    
    // Add package-specific methods if we recognize the package
    // This is just an optimization, but the default methods should work for most servers
    if (packageName) {
      console.log(`Detected potential MCP package: ${packageName}`);
      
      // Known server-specific method optimizations
      if (packageName.includes('@modelcontextprotocol/server-filesystem')) {
        methodsToTry.unshift('fs/listTools'); // Try first for filesystem server
      } else if (packageName.includes('@playwright/mcp')) {
        methodsToTry.unshift('browser/listTools'); // Try first for playwright
      } else if (packageName.includes('anthropic-sdk')) {
        methodsToTry.unshift('anthropic/listTools'); // Anthropic SDK
      } else if (packageName.includes('openai-sdk')) {
        methodsToTry.unshift('openai/listTools'); // OpenAI SDK
      }
      
      // Add package namespace variants for any package
      // Extract package name without version for use in namespacing
      const baseName = (packageName.match(/@?[^@\/]+\/[^@\/]+/) || [''])[0]
        .replace(/^@/, '')
        .replace(/\//g, '.')
        .replace(/-/g, '_');
      
      if (baseName) {
        // Add custom namespace-based methods for this package
        methodsToTry.unshift(
          `${baseName}/tools/list`,
          `${baseName}/listTools`,
          `${baseName}/list_tools`
        );
      }
    }

    // Function to send the next method to try
    const tryNextMethod = () => {
      if (currentMethodIndex >= methodsToTry.length) {
        reject(new Error(`All discovery methods failed. Server does not support any known MCP tool discovery methods.`));
        return;
      }

      const method = methodsToTry[currentMethodIndex++];
      const request = JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        id: `discover-${Date.now()}`,
      });

      console.log(`Trying discovery method: ${method}`);
      responseData = ''; // Clear existing response data
      childProcess.stdin!.write(request + '\n');
      
      // Only end stdin after the last method attempt
      if (currentMethodIndex >= methodsToTry.length) {
        childProcess.stdin!.end();
      }
    };

    // Handle stdout
    childProcess.stdout!.on('data', (data: Buffer) => {
      responseData += data.toString();
      console.log(`Stdio stdout: ${data.toString()}`);
      
      // Check if we received a potential JSON response
      try {
        // Attempt to parse *cumulative* data
        const potentialJson = JSON.parse(responseData);
        
        // Handle success response for tools/list
        if (potentialJson.result && potentialJson.result.tools) {
          if (responseTimeout) clearTimeout(responseTimeout);
          console.log('Received tools response via stdio.');
          if (Array.isArray(potentialJson.result.tools)) {
            resolve(potentialJson.result.tools as MCPTool[]);
            
            // Kill process if it's still running after we got the response
            if (childProcess.exitCode === null) childProcess.kill(60);
            return;
          } else {
            console.log('Invalid tools format in response, trying next method.');
            tryNextMethod();
          }
        } 
        // Handle error response with method not found
        else if (potentialJson.error && potentialJson.error.code === -32601) {
          console.log(`Method ${methodsToTry[currentMethodIndex - 1]} not found. Trying next method...`);
          tryNextMethod();
        }
        // Any other response format, try next method
        else {
          console.log('Unrecognized response format, trying next method.');
          tryNextMethod();
        }
      } catch (e) {
        // Incomplete JSON, wait for more data or timeout
        console.log("Stdio stdout: Received partial data or non-JSON.");
      }
    });

    // Handle stderr
    childProcess.stderr!.on('data', (data: Buffer) => {
      errorData += data.toString();
      console.error(`Stdio stderr: ${data.toString()}`);
    });

    // Handle process exit
    childProcess.on('close', (code: number | null) => {
      if (responseTimeout) clearTimeout(responseTimeout);
      
      // If process exited without returning tools, report failure
      if (code !== 0) {
        console.error(`Process exited with code ${code ?? 'null'}. Stderr: ${errorData}`);
        reject(new Error(`Server process exited with code ${code ?? 'null'}. Error: ${errorData || 'Unknown error'}`));
      } else {
        // Exited cleanly but no valid response received
        reject(new Error(`Server process exited cleanly (code ${code ?? 'null'}) but did not return tools. Stderr: ${errorData}`));
      }
    });

    // Handle process errors (e.g., command not found)
    childProcess.on('error', (err: Error) => {
      if (responseTimeout) clearTimeout(responseTimeout);
      console.error('Failed to start subprocess.', err);
      reject(new Error(`Failed to start server process: ${err.message}`));
    });

    // Start with the first method
    console.log(`Starting tool discovery with method: ${methodsToTry[0]}`);
    tryNextMethod();

    // Timeout for the response
    responseTimeout = setTimeout(() => {
      console.error('Stdio response timeout (20s).');
      // Check if process is still running before killing
      if (childProcess.exitCode === null) childProcess.kill(15); // SIGTERM signal number
      reject(new Error('Timeout waiting for tool discovery response from server process.'));
    }, 20000); // Increased timeout to 20 seconds
  });
}

// Function to send MCP request via HTTP POST and get response
async function discoverToolsViaHttp(url: string): Promise<MCPTool[]> {
   // Default methods to try based on MCP protocol specification
   // Listed in order of preference according to MCP standards
   const methods = [
     'tools/list',           // Standard MCP method (preferred)
     'listTools',            // Common camelCase variant
     'list_tools',           // Common snake_case variant
     'ListTools',            // Common PascalCase variant
     'rpc.discover',         // JSON-RPC discovery
     'server.capabilities',  // Server capabilities
     'discovery',            // Generic discovery method
     'getTools',             // Generic getter
     'get_tools',            // Generic snake_case getter
   ];
   
   // Try to extract potential namespace from URL
   // This allows us to attempt namespace-specific methods
   const urlParts = new URL(url).pathname.split('/').filter(Boolean);
   if (urlParts.length > 0) {
     const possibleNamespace = urlParts[urlParts.length - 1]
       .replace(/-/g, '_')
       .toLowerCase();
     
     if (possibleNamespace && possibleNamespace !== 'mcp') {
       // Add namespace-specific methods at the beginning
       methods.unshift(
         `${possibleNamespace}/tools/list`,
         `${possibleNamespace}/listTools`,
         `${possibleNamespace}/list_tools`
       );
     }
   }
   
   let lastError = null;
   let isHtmlResponse = false;
   
   // First check if the endpoint exists and is not just serving HTML
   try {
     const initialCheck = await fetch(url, {
       method: 'GET',
       headers: {
         'Accept': 'application/json, text/plain, */*',
       },
       signal: AbortSignal.timeout(5000)
     });

     const contentType = initialCheck.headers.get('content-type');
     
     // Check if we're getting HTML instead of JSON/API response
     if (contentType && contentType.includes('text/html')) {
       // Try to read a bit of the content to confirm it's HTML
       const textPreview = await initialCheck.text();
       if (textPreview.trim().toLowerCase().startsWith('<!doctype html') || 
           textPreview.trim().toLowerCase().startsWith('<html')) {
         isHtmlResponse = true;
         throw new Error("The server at this URL appears to be a regular web server, not an MCP server. Received HTML instead of an API response.");
       }
     }
   } catch (error) {
     if (isHtmlResponse) {
       // Re-throw the specific HTML error to break out of the function
       throw error;
     }
     // For other errors, we'll continue with the discovery attempts
     console.log("Initial endpoint check failed, continuing with method discovery:", error);
   }
   
   // If we detect that this is a Nginx or Apache static site, stop early with a helpful error
   try {
     // Try to detect common web server signatures
     const serverCheck = await fetch(url, {
       method: 'GET',
       headers: {
         'Accept': '*/*',
       },
       signal: AbortSignal.timeout(3000)
     });
     
     const serverHeader = serverCheck.headers.get('server');
     if (serverHeader && (serverHeader.includes('nginx') || serverHeader.includes('Apache'))) {
       const textPreview = await serverCheck.text();
       if (textPreview.trim().toLowerCase().startsWith('<!doctype html') || 
           textPreview.trim().toLowerCase().startsWith('<html')) {
         throw new Error(`The URL ${url} is a static web server (${serverHeader}), not an MCP server. It's serving HTML pages instead of responding to MCP protocol requests.`);
       }
     }
   } catch (error) {
     // If this is our specific error, throw it up
     if (error instanceof Error && (
         error.message.includes('static web server') || 
         error.message.includes('HTML instead of'))) {
       throw error;
     }
     // Otherwise continue with the discovery attempts
   }
   
   // Try each method until one works
   for (const method of methods) {
     const listToolsRequest = {
        jsonrpc: '2.0',
        method: method,
        id: `discover-${Date.now()}`,
     };

     console.log(`Trying HTTP POST discovery with method: ${method} to URL: ${url}`);

     try {
        const response = await fetch(url, {
           method: 'POST',
           headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
           },
           body: JSON.stringify(listToolsRequest),
           signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        // Check if we got HTML instead of JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          const textPreview = await response.text();
          if (textPreview.trim().toLowerCase().startsWith('<!doctype html') || 
              textPreview.trim().toLowerCase().startsWith('<html')) {
            throw new Error("The server at this URL is returning HTML instead of JSON. This is likely not an MCP server but a static web page.");
          }
        }

        if (!response.ok) {
           console.log(`HTTP error with method ${method}: ${response.status} ${response.statusText}`);
           lastError = new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
           continue; // Try next method
        }

        // Try to parse content as JSON
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.log(`Failed to parse JSON response from ${method}: ${jsonError}`);
          
          // Sample a bit of the text to see what we got
          const responseBody = await response.text();
          const preview = responseBody.substring(0, 100);
          
          if (preview.includes('<!DOCTYPE') || preview.includes('<html')) {
            // This is definitely HTML, so we can stop here
            throw new Error(`The server at ${url} is returning HTML when it should return JSON. This is not an MCP server.`);
          }
          
          lastError = new Error(`Failed to parse JSON response: ${jsonError} - Response preview: ${preview}`);
          continue; // Try next method
        }

        console.log(`Received HTTP response for method ${method}:`, data);

        // Handle method not found errors
        if (data.error && data.error.code === -32601) {
           console.log(`Method ${method} not found, trying next method.`);
           continue; // Try next method
        }
        
        // Handle other errors
        if (data.error) {
           lastError = new Error(`MCP Error: ${data.error.message} (Code: ${data.error.code})`);
           console.log(`Error with method ${method}: ${data.error.message}`);
           continue; // Try next method
        }

        // Handle success
        if (data.result && Array.isArray(data.result.tools)) {
           return data.result.tools as MCPTool[];
        } else {
           console.log(`Method ${method} returned invalid tools format, trying next method.`);
           continue; // Try next method
        }
     } catch (error: any) {
         console.error(`HTTP discovery failed for ${url} with method ${method}:`, error);
         lastError = error;
         // Continue to next method
     }
   }
   
   // If we get here, all methods failed
   if (lastError) {
     throw lastError;
   } else {
     throw new Error(`Failed to discover tools via HTTP: No valid response from any discovery method`);
   }
}


// --- API Route Handler ---

export async function POST(request: NextRequest) {
  try {
    const body: DiscoverRequest = await request.json();
    let discoveredTools: MCPTool[] = [];

    console.log(`Received discovery request: ${JSON.stringify(body)}`);

    if (body.type === 'config') {
      // Validate config - basic check
      if (!body.config || !body.config.command) {
         throw new Error('Invalid configuration provided for discovery.');
      }
      discoveredTools = await discoverToolsViaStdio(
        body.config.command,
        body.config.args || [],
        body.config.env
      );
    } else if (body.type === 'url') {
       // Validate URL - basic check
       if (!body.url || !body.url.startsWith('http')) {
           throw new Error('Invalid URL provided for discovery.');
       }
      // Attempt HTTP discovery (could add SSE later if needed)
      discoveredTools = await discoverToolsViaHttp(body.url);
    } else {
      return NextResponse.json({ error: 'Invalid discovery request type' }, { status: 400 });
    }

    console.log(`Discovery successful for ${body.serverId}. Found ${discoveredTools.length} tools.`);
    return NextResponse.json({ tools: discoveredTools });

  } catch (error: any) {
    console.error('Error during MCP discovery:', error);
    return NextResponse.json(
      { error: `Discovery failed: ${error.message}` },
      { status: 500 }
    );
  }
}
