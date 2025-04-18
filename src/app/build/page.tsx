import { Navbar } from "../../components/layout/navbar";
import { ServerBuilder } from "../../components/server/server-builder";

export default function BuildPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-8">
        <div className="container mx-auto max-w-[1920px]">
          {/* <div className="mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 gradient-text inline-block">Build MCP Servers</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Create powerful MCP servers that enable AI assistants to perform tasks for your users. 
              Just describe what you want, and we'll generate the tools and API implementations.
            </p>
          </div> */}
          
          <ServerBuilder />
        </div>
      </main>
    </div>
  );
}