import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts code blocks from markdown text
 * @param text The markdown text containing code blocks
 * @returns An array of objects with filename and content properties
 */
export function extractCodeBlocksFromMarkdown(text: string) {
  const files: { filename: string; content: string }[] = [];
  // Track filenames to handle duplicates
  const filenameCounter: Record<string, number> = {};
  
  // Regular expression to match markdown code blocks with optional filenames
  // Format: ```language:filename or ```language or just ```
  const codeBlockRegex = /```(?:(\w+)(?:\s*:\s*([^\n]+))?)?\n([\s\S]*?)```/g;
  
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const [_, language = '', filename = '', content] = match;
    
    // Determine the filename based on the language if not specified
    let finalFilename = filename.trim();
    if (!finalFilename) {
      switch (language.toLowerCase()) {
        case 'typescript':
        case 'ts':
          finalFilename = 'index.ts';
          break;
        case 'javascript':
        case 'js':
          finalFilename = 'index.js';
          break;
        case 'dockerfile':
          finalFilename = 'Dockerfile';
          break;
        case 'yaml':
        case 'yml':
          finalFilename = 'docker-compose.yml';
          break;
        case 'json':
          // Try to identify specific JSON file types based on content
          try {
            const jsonContent = JSON.parse(content);
            
            // Check for tsconfig.json patterns
            if (jsonContent.compilerOptions && 
                (jsonContent.compilerOptions.target || 
                 jsonContent.compilerOptions.module || 
                 jsonContent.compilerOptions.lib)) {
              finalFilename = 'tsconfig.json';
            } else {
              // Default to package.json for other JSON files
              finalFilename = 'package.json';
            }
          } catch (e) {
            // If parsing fails, default to package.json
            finalFilename = 'package.json';
          }
          break;
        case 'markdown':
        case 'md':
          finalFilename = 'README.md';
          break;
        default:
          // Use a generic name if language is unknown
          finalFilename = `file-${files.length + 1}.txt`;
      }
    }
    
    // Handle duplicate filenames by adding a suffix
    if (filenameCounter[finalFilename]) {
      const currentCount = filenameCounter[finalFilename]++;
      const fileExt = finalFilename.includes('.') ? finalFilename.split('.').pop() : '';
      const fileBase = finalFilename.includes('.') ? finalFilename.split('.').slice(0, -1).join('.') : finalFilename;
      finalFilename = `${fileBase}-${currentCount}.${fileExt}`;
    } else {
      filenameCounter[finalFilename] = 1;
    }
    
    // Extract the content and trim any leading/trailing whitespace
    files.push({
      filename: finalFilename,
      content: content.trim()
    });
  }
  
  // Handle special case for .env.example
  const envExample = text.match(/## \.env\.example\n```\n([\s\S]*?)```/);
  if (envExample && envExample[1]) {
    files.push({
      filename: '.env.example',
      content: envExample[1].trim()
    });
  }
  
  return files;
}

/**
 * Extracts environment variables from .env.example file
 * @param envExampleContent The content of the .env.example file
 * @returns An object with variable names as keys and empty strings as values
 */
export function extractEnvVarsFromExample(envExampleContent: string) {
  const envVars: Record<string, string> = {};
  
  // Split the content by lines and process each line
  const lines = envExampleContent.split('\n');
  
  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue;
    
    // Try to extract variable name
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match) {
      const [_, name, defaultValue] = match;
      // Initialize with empty string or the default value if it's not a placeholder
      const value = defaultValue.includes('your_') || defaultValue.includes('YOUR_') ? '' : defaultValue;
      envVars[name] = value;
    }
  }
  
  return envVars;
}
