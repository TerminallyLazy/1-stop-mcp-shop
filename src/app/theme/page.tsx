import { Navbar } from "@/components/layout/navbar";
import { DarkThemeShowcase } from "@/components/theme/dark-theme-showcase";

export default function ThemePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <DarkThemeShowcase />
      </main>
    </div>
  );
}
