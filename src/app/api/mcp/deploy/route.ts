import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import yaml from 'yaml';
import net from 'net';

// Promisify exec for cleaner async/await usage
const execAsync = promisify(exec);

// Base directory for deployments - use a directory Docker can access by default
const DEPLOY_BASE_DIR = process.env.DEPLOY_BASE_DIR || path.join(process.cwd(), 'docker-deployments');

// Ensure the base directory exists at startup
try {
  if (!fs.existsSync(DEPLOY_BASE_DIR)) {
    fs.mkdirSync(DEPLOY_BASE_DIR, { recursive: true });
    console.log(`Created deployment base directory: ${DEPLOY_BASE_DIR}`);
  }
} catch (err) {
  console.error(`Failed to create deployment directory: ${err}`);
}

interface FileContent {
  filename: string;
  content: string;
}

// Default Tailwind config for proper styling
const DEFAULT_POSTCSS_CONFIG = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
};

// Function to check if docker-compose is installed (checks both traditional and plugin versions)
async function checkDockerComposeInstalled() {
  try {
    // Try traditional docker-compose first
    try {
      await execAsync('which docker-compose');
      return { installed: true, command: 'docker-compose' };
    } catch (error) {
      // If traditional version fails, try the plugin version (docker compose)
      try {
        // Check if docker is installed first
        await execAsync('which docker');

        // Then try to run a simple docker compose command to verify it works
        await execAsync('docker compose version');
        return { installed: true, command: 'docker compose' };
      } catch (composeError) {
        console.error('Error checking docker compose plugin:', composeError);
        return { installed: false, error: composeError };
      }
    }
  } catch (error) {
    console.error('Error checking docker installation:', error);
    return { installed: false, error };
  }
}

// Function to find an available port starting from a given port
async function findAvailablePort(startPort: number, maxPort: number = startPort + 1000): Promise<number> {
  for (let port = startPort; port <= maxPort; port++) {
    try {
      const server = net.createServer();

      const available = await new Promise<boolean>((resolve) => {
        server.once('error', (err) => {
          // Port is likely in use
          resolve(false);
        });

        server.once('listening', () => {
          server.close();
          resolve(true);
        });

        server.listen(port);
      });

      if (available) {
        console.log(`Found available port: ${port}`);
        return port;
      }
    } catch (err) {
      console.error(`Error checking port ${port}:`, err);
    }
  }

  throw new Error(`No available ports found between ${startPort} and ${maxPort}`);
}

export const POST = async (request: Request) => {
  try {
    const { projectName, files, envVars } = await request.json();

    if (!projectName || !files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: projectName and files' },
        { status: 400 }
      );
    }

    // Check if docker-compose is installed
    const dockerCompose = await checkDockerComposeInstalled();
    if (!dockerCompose.installed) {
      const errorDetails = dockerCompose.error ? `Error details: ${dockerCompose.error}` : '';
      return NextResponse.json(
        {
          success: false,
          error: `Docker Compose is not installed or not in PATH. Please install Docker Compose to continue. ${errorDetails}`
        },
        { status: 500 }
      );
    }

    // Create a sanitized project name
    const sanitizedProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Create a unique deployment directory
    const deployDir = path.join(DEPLOY_BASE_DIR, `${sanitizedProjectName}-${Date.now()}`);

    // Ensure the deploy base directory exists
    await fs.promises.mkdir(DEPLOY_BASE_DIR, { recursive: true });

    // Create the project directory
    await fs.promises.mkdir(deployDir, { recursive: true });
    console.log(`Created deployment directory: ${deployDir}`);

    // Check if we need a tsconfig.json file
    const hasTypeScriptFiles = files.some(
      file => file.filename.endsWith('.ts') || file.filename.endsWith('.tsx')
    );
    const hasTsConfig = files.some(file => file.filename === 'tsconfig.json');

    // If this is a TypeScript project but no tsconfig.json is provided, add one
    if (hasTypeScriptFiles && !hasTsConfig) {
      const defaultTsConfig = {
        compilerOptions: {
          target: "es2016",
          module: "commonjs",
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          strict: true,
          skipLibCheck: true
        }
      };

      files.push({
        filename: 'tsconfig.json',
        content: JSON.stringify(defaultTsConfig, null, 2)
      });

      console.log('Added default tsconfig.json for TypeScript project');
    }

    // Check if there's a tailwind.config.js file in the project
    const hasTailwindConfig = files.some(
      file => file.filename === 'tailwind.config.js' || file.filename === 'tailwind.config.ts'
    );

    // If using Tailwind but no PostCSS config exists, add one
    const hasPostCSSConfig = files.some(file => file.filename === 'postcss.config.js');
    if (hasTailwindConfig && !hasPostCSSConfig) {
      files.push({
        filename: 'postcss.config.js',
        content: `module.exports = ${JSON.stringify(DEFAULT_POSTCSS_CONFIG, null, 2)}`
      });
      console.log('Added postcss.config.js for Tailwind CSS');
    }

    // Process files before writing them (fix docker-compose.yml issues)
    const writtenFiles = [];

    // Check if there's a Dockerfile in the files
    const hasDockerfile = files.some(file => file.filename === 'Dockerfile');

    // Check if there's a docker-compose.yml already
    const hasDockerCompose = files.some(file =>
      file.filename === 'docker-compose.yml' || file.filename.endsWith('/docker-compose.yml')
    );

    // Find an available port for the service
    const basePort = 3000;
    let availablePort;
    try {
      availablePort = await findAvailablePort(basePort);
      console.log(`Using port ${availablePort} for Docker deployment`);
    } catch (portError) {
      console.error('Port finding error:', portError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to find an available port: ${portError instanceof Error ? portError.message : String(portError)}`
        },
        { status: 500 }
      );
    }

    // Always prioritize the Nginx approach for reliability
    files.push({
      filename: 'docker-compose.yml',
      content: `services:
  server:
    image: nginx:alpine
    ports:
      - "${availablePort}:80"
    volumes:
      - type: bind
        source: .
        target: /usr/share/nginx/html
`
    });
    console.log(`Added simple nginx docker-compose.yml file using port ${availablePort}`);

    // Add a basic HTML file if it doesn't exist
    const hasHTML = files.some(file => file.filename.endsWith('.html'));
    if (!hasHTML) {
      // Get a list of filenames for display
      const fileList = files.map(f => f.filename).filter(Boolean).join('\n');

      files.push({
        filename: 'index.html',
        content: `<!DOCTYPE html>
<html>
<head>
  <title>MCP Server</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow: auto; }
  </style>
</head>
<body>
  <h1>MCP Server Deployed</h1>
  <p>Your MCP server is now running using a basic Nginx container.</p>
  <p>To add application-specific functionality, you may need to customize the Dockerfile or docker-compose.yml file.</p>

  <h2>Deployed Files:</h2>
  <pre id="files">${fileList}</pre>
</body>
</html>`
      });
      console.log('Added basic index.html file for nginx with pre-generated file list');
    }

    // If there was an existing Dockerfile, rename it to prevent conflicts
    if (hasDockerfile) {
      const dockerfileIndex = files.findIndex(file => file.filename === 'Dockerfile');
      if (dockerfileIndex >= 0) {
        files[dockerfileIndex].filename = 'Dockerfile.original';
        console.log('Renamed existing Dockerfile to Dockerfile.original to prevent conflicts');
      }
    }

    for (const file of files) {
      let fileContent = file.content;

      // Fix docker-compose.yml - remove obsolete 'version' attribute
      if (file.filename === 'docker-compose.yml' || file.filename.endsWith('/docker-compose.yml')) {
        try {
          // Parse the YAML content
          let composeConfig = yaml.parse(fileContent);

          // Remove the 'version' property if it exists
          if (composeConfig && composeConfig.version) {
            delete composeConfig.version;
            fileContent = yaml.stringify(composeConfig);
            console.log('Removed obsolete version attribute from docker-compose.yml');
          }
        } catch (yamlError) {
          console.warn('Failed to parse docker-compose.yml:', yamlError);
          // Continue with original content if parsing fails
        }
      }

      const filePath = path.join(deployDir, file.filename);

      // Ensure parent directory exists (for nested files)
      const parentDir = path.dirname(filePath);
      await fs.promises.mkdir(parentDir, { recursive: true });

      await fs.promises.writeFile(filePath, fileContent);
      writtenFiles.push(file.filename);
    }
    console.log(`Written files: ${writtenFiles.join(', ')}`);

    // Create .env file with provided environment variables
    if (envVars && Object.keys(envVars).length > 0) {
      const envContent = Object.entries(envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      await fs.promises.writeFile(path.join(deployDir, '.env'), envContent);
      console.log(`Created .env file with ${Object.keys(envVars).length} variables`);
    }

    // Execute deployment with Docker
    console.log('Starting Docker build and deployment...');
    try {
      // Move to the deployment directory
      process.chdir(deployDir);

      // Run docker-compose with the appropriate command (traditional or plugin)
      const { stdout: composeOutput, stderr: composeError } = await execAsync(`${dockerCompose.command} up -d --build`);
      console.log('Docker compose output:', composeOutput);

      if (composeError) {
        console.warn('Docker compose warnings:', composeError);
      }

      // Get container information using the appropriate command
      const { stdout: psOutput } = await execAsync(`${dockerCompose.command} ps`);

      return NextResponse.json({
        success: true,
        deploymentPath: deployDir,
        files: writtenFiles,
        dockerOutput: composeOutput,
        dockerStatus: psOutput,
        url: `http://localhost:${availablePort}` // Use the discovered port
      });
    } catch (dockerError) {
      console.error('Docker deployment error:', dockerError);

      // Provide a helpful error message
      let errorMessage = dockerError instanceof Error ? dockerError.message : String(dockerError);

      // Add guidance for common errors
      if (errorMessage.includes('command not found')) {
        errorMessage += '. Make sure Docker Compose is installed and in your PATH.';
      } else if (errorMessage.includes('permission denied')) {
        errorMessage += '. Make sure you have permission to run Docker commands.';
      } else if (errorMessage.includes('Connection refused')) {
        errorMessage += '. Make sure Docker daemon is running.';
      }

      return NextResponse.json({
        success: false,
        error: `Docker deployment failed: ${errorMessage}`,
        deploymentPath: deployDir,
        files: writtenFiles
      });
    }
  } catch (error) {
    console.error('Error in /api/mcp/deploy:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
};