import { Navbar } from "@/components/layout/navbar";
import { ServerBuilder } from "@/components/server/server-builder";

export default function BuildPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <ServerBuilder />
      </main>
    </div>
  );
}
