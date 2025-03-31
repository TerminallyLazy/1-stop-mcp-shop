import { Navbar } from "@/components/layout/navbar";
import { EnhancedMCPClient } from "@/components/client/enhanced-mcp-client";

export default function ClientPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <EnhancedMCPClient />
      </main>
    </div>
  );
}
