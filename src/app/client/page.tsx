import { Navbar } from "../../components/layout/navbar";
import { EnhancedMCPClientUpdated } from "../../components/client/enhanced-mcp-client-updated";

export default function ClientPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <EnhancedMCPClientUpdated />
      </main>
    </div>
  );
}
