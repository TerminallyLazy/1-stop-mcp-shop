import { Navbar } from "../../components/layout/navbar";
import { ServerManager } from "../../components/server/server-manager";

export default function ManagePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <ServerManager />
      </main>
    </div>
  );
}
