import { Navbar } from "../../components/layout/navbar";
import { MarketplaceClient } from "../../components/marketplace/marketplace-client";

export default function MarketplacePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <MarketplaceClient />
      </main>
    </div>
  );
}
