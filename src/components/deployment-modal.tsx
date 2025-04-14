import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { extractCodeBlocksFromMarkdown, extractEnvVarsFromExample } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

type DeploymentStatus = "idle" | "preparing" | "deploying" | "success" | "error";

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverCode: string;
  serverName: string;
}

// Default tsconfig.json for TypeScript projects
const DEFAULT_TSCONFIG = {
  compilerOptions: {
    target: "es2016",
    module: "commonjs",
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    strict: true,
    skipLibCheck: true
  }
};

// Default empty package-lock.json to satisfy Docker requirements
const DEFAULT_PACKAGE_LOCK = {
  name: "mcp-server",
  version: "1.0.0",
  lockfileVersion: 3,
  requires: true,
  packages: {
    "": {
      "name": "mcp-server",
      "version": "1.0.0"
    }
  }
};

export function DeploymentModal({ isOpen, onClose, serverCode, serverName }: DeploymentModalProps) {
  const [files, setFiles] = useState<{ filename: string; content: string }[]>([]);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<DeploymentStatus>("idle");
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [activeFileTab, setActiveFileTab] = useState<string>("");

  // Parse server code to extract files and env vars when the modal opens
  useEffect(() => {
    if (isOpen && serverCode) {
      try {
        // Extract files from markdown code blocks
        const extractedFiles = extractCodeBlocksFromMarkdown(serverCode);

        // Check if tsconfig.json exists, add it if it doesn't
        const hasTsConfig = extractedFiles.some(file => file.filename === 'tsconfig.json');
        if (!hasTsConfig) {
          // Check if there are any TypeScript files (.ts or .tsx)
          const hasTypeScriptFiles = extractedFiles.some(file =>
            file.filename.endsWith('.ts') || file.filename.endsWith('.tsx')
          );

          // Add a default tsconfig.json if we have TypeScript files
          if (hasTypeScriptFiles) {
            // Ensure the filename doesn't conflict with existing files
            let tsConfigFilename = 'tsconfig.json';

            // Check if this filename will conflict with any existing entries
            if (extractedFiles.some(file => file.filename === tsConfigFilename)) {
              console.warn('Unexpected conflict: tsconfig.json already exists with different casing or as another file');
              tsConfigFilename = 'tsconfig.generated.json';
            }

            extractedFiles.push({
              filename: tsConfigFilename,
              content: JSON.stringify(DEFAULT_TSCONFIG, null, 2)
            });
          }
        }

        // Check if package-lock.json exists, add it if it doesn't
        const hasPackageLock = extractedFiles.some(file => file.filename === 'package-lock.json');
        if (!hasPackageLock) {
          // Check if there's a package.json file (Node.js project)
          const hasPackageJson = extractedFiles.some(file => file.filename === 'package.json');

          // Add a default package-lock.json if we have a package.json
          if (hasPackageJson) {
            // Generate package-lock.json with project name from package.json if possible
            let packageName = 'mcp-server';
            let packageVersion = '1.0.0';

            try {
              const packageJsonFile = extractedFiles.find(file => file.filename === 'package.json');
              if (packageJsonFile) {
                const packageJson = JSON.parse(packageJsonFile.content);
                packageName = packageJson.name || packageName;
                packageVersion = packageJson.version || packageVersion;

                // Extract dependencies from package.json
                const dependencies = packageJson.dependencies || {};
                const devDependencies = packageJson.devDependencies || {};

                // Update the package lock with actual dependencies
                const packageLock: {
                  name: string;
                  version: string;
                  lockfileVersion: number;
                  requires: boolean;
                  packages: Record<string, any>;
                } = {
                  ...DEFAULT_PACKAGE_LOCK,
                  name: packageName,
                  version: packageVersion,
                  packages: {
                    "": {
                      name: packageName,
                      version: packageVersion,
                      dependencies: dependencies,
                      devDependencies: devDependencies
                    }
                  }
                };

                // Add each dependency to the packages section
                Object.entries(dependencies).forEach(([name, version]) => {
                  packageLock.packages[`node_modules/${name}`] = {
                    version: String(version).replace(/[^0-9.]/g, ''),
                    resolved: `https://registry.npmjs.org/${name}/-/${name}-${String(version).replace(/[^0-9.]/g, '')}.tgz`,
                    integrity: `sha512-${Math.random().toString(36).substring(2, 15)}`,
                    dependencies: {}
                  };
                });

                extractedFiles.push({
                  filename: 'package-lock.json',
                  content: JSON.stringify(packageLock, null, 2)
                });
              }
            } catch (e) {
              console.warn('Failed to parse package.json', e);

              extractedFiles.push({
                filename: 'package-lock.json',
                content: JSON.stringify(DEFAULT_PACKAGE_LOCK, null, 2)
              });
            }
          }
        }

        setFiles(extractedFiles);

        // Find the .env.example file to extract variables
        const envExampleFile = extractedFiles.find((f: { filename: string; content: string }) => f.filename === '.env.example');
        if (envExampleFile) {
          const vars = extractEnvVarsFromExample(envExampleFile.content);
          setEnvVars(vars);
        }

        // Set default project name based on server name
        const sanitizedName = serverName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        setProjectName(sanitizedName || 'mcp-server');

        // Set the first file as active by default
        if (extractedFiles.length > 0) {
          setActiveFileTab(extractedFiles[0].filename);
        }
      } catch (error) {
        console.error("Error parsing server code:", error);
        setError("Failed to parse server code. Please try again.");
      }
    }
  }, [isOpen, serverCode, serverName]);

  // Handle form submission for deployment
  const handleDeploy = async () => {
    try {
      setStatus("preparing");
      setError(null);

      if (!projectName.trim()) {
        setError("Project name is required");
        setStatus("idle");
        return;
      }

      // Start deployment
      setStatus("deploying");

      // Call the deployment API
      const response = await fetch('/api/mcp/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectName,
          files,
          envVars
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Deployment failed');
      }

      setDeploymentResult(result);
      setStatus("success");
    } catch (error) {
      console.error("Deployment error:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
      setStatus("error");
    }
  };

  // Handle env var change
  const handleEnvVarChange = (key: string, value: string) => {
    setEnvVars(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-[75vw] w-[98vw] max-h-[95vh] h-[95vh] overflow-y-auto p-2 md:p-4">
        <DialogHeader className="p-2">
          <DialogTitle>Deploy MCP Server</DialogTitle>
          <DialogDescription>
            Configure and deploy your MCP server with Docker.
          </DialogDescription>
        </DialogHeader>

        {status === "idle" || status === "preparing" ? (
          <>
            <div className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter a name for your project"
                />
              </div>

              <div className="grid gap-3">
                <Label>Files to Deploy</Label>
                <div className="border rounded-md">
                  <Tabs value={activeFileTab} onValueChange={setActiveFileTab} className="w-full">
                    <div className="border-b px-3 overflow-x-auto whitespace-nowrap">
                      <TabsList className="h-10 inline-flex w-auto bg-transparent p-0">
                        {files.map((file) => (
                          <TabsTrigger
                            key={file.filename}
                            value={file.filename}
                            className="deployment-tab px-3 data-[state=active]:shadow-none relative data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                          >
                            {file.filename}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>

                    {files.map((file) => (
                      <TabsContent key={file.filename} value={file.filename} className="p-4">
                        <pre className="bg-gray-800 text-gray-200 p-4 rounded-md overflow-auto max-h-[400px] text-sm">
                          <code>{file.content}</code>
                        </pre>
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              </div>

              {Object.keys(envVars).length > 0 && (
                <div className="grid gap-3">
                  <Label>Environment Variables</Label>
                  <div className="border rounded-md p-4 grid gap-4">
                    {Object.entries(envVars).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-3 gap-2 items-center">
                        <div className="font-mono text-sm">{key}</div>
                        <div className="col-span-2">
                          <Input
                            value={value}
                            onChange={(e) => handleEnvVarChange(key, e.target.value)}
                            placeholder={`Enter value for ${key}`}
                            type={key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('password') ? 'password' : 'text'}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleDeploy}
                disabled={status === "preparing"}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {status === "preparing" ? "Preparing..." : "Deploy with Docker"}
              </Button>
            </DialogFooter>
          </>
        ) : status === "deploying" ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-opacity-20 border-t-primary rounded-full mb-4"></div>
            <h3 className="text-lg font-medium mb-2">Deploying your MCP server</h3>
            <p className="text-muted-foreground text-center">
              This may take a minute or two while we build and start the Docker container.
            </p>
          </div>
        ) : status === "success" ? (
          <div className="flex flex-col py-6">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full p-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center mb-6">Deployment Successful!</h2>

            <div className="grid gap-4">
              <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <AlertTitle className="text-green-700 dark:text-green-300">Server Deployed</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-400">
                  Your MCP server is now running on Docker.
                </AlertDescription>
              </Alert>

              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">Deployment Details</h3>
                <div className="grid gap-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deployment Path:</span>
                    <code className="text-sm bg-muted px-1 py-0.5 rounded">{deploymentResult?.deploymentPath}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">URL:</span>
                    <a href={deploymentResult?.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">
                      {deploymentResult?.url}
                    </a>
                  </div>
                </div>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">Docker Status</h3>
                <pre className="bg-black text-green-400 p-3 rounded-md text-xs overflow-auto max-h-[150px]">
                  {deploymentResult?.dockerStatus}
                </pre>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col py-6">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded-full p-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" x2="9" y1="9" y2="15"></line>
                  <line x1="9" x2="15" y1="9" y2="15"></line>
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center mb-6">Deployment Failed</h2>

            <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <AlertTitle className="text-red-700 dark:text-red-300">Error</AlertTitle>
              <AlertDescription className="text-red-600 dark:text-red-400">
                {error || "An unknown error occurred during deployment."}
              </AlertDescription>
            </Alert>

            {error && error.includes('Docker Compose is not installed') && (
              <div className="mt-4 border rounded-md p-4">
                <h3 className="font-medium mb-2">Installation Instructions</h3>
                <p className="mb-2">Docker Compose wasn't detected by the system. This could be because:</p>

                <ul className="list-disc pl-5 mb-4 space-y-1">
                  <li>Docker Compose is not installed</li>
                  <li>Docker Compose is installed but not in your system PATH</li>
                  <li>You're using newer Docker with the plugin version (<code>docker compose</code> vs <code>docker-compose</code>)</li>
                </ul>

                <div className="bg-gray-800 text-gray-200 p-4 rounded-md overflow-auto text-sm mt-3">
                  <h4 className="text-sm font-bold mb-2">Verify your installation:</h4>
                  <pre className="mb-2">docker compose version</pre>
                  <pre className="mb-2">docker-compose --version</pre>

                  <h4 className="text-sm font-bold mb-2 mt-4">For Linux:</h4>
                  <pre className="mb-2">sudo apt-get update && sudo apt-get install docker-compose-plugin</pre>
                  <h4 className="text-sm font-bold mb-2">macOS:</h4>
                  <pre className="mb-2">brew install docker-compose</pre>
                  <h4 className="text-sm font-bold mb-2">Windows:</h4>
                  <pre>Install Docker Desktop which includes Docker Compose</pre>
                </div>

                <p className="mt-4 text-sm text-muted-foreground">
                  For more information, visit the <a href="https://docs.docker.com/compose/install/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Docker Compose installation guide</a>.
                </p>
              </div>
            )}

            {error && error.includes('npm ci') && (
              <div className="mt-4 border rounded-md p-4">
                <h3 className="font-medium mb-2">NPM Installation Error</h3>
                <p className="mb-2">The npm ci command failed during Docker deployment. This could be because:</p>

                <ul className="list-disc pl-5 mb-4 space-y-1">
                  <li>The package.json is missing required dependencies</li>
                  <li>The package-lock.json doesn't match the package.json</li>
                  <li>There are private npm packages that require authentication</li>
                </ul>

                <p className="mt-2">A default Dockerfile has been added that uses <code>npm install</code> instead of <code>npm ci</code>, which should be more forgiving with package-lock.json discrepancies.</p>
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setStatus("idle")}>
                Try Again
              </Button>
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}