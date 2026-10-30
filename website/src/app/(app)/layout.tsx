import { AppShell } from "@/components/AppShell";
import { MapsConfigProvider } from "@/components/MapsConfig";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Read at request time (not build time), so the key can be set or changed
  // on the server without rebuilding the site.
  const maps = {
    apiKey: process.env.GOOGLE_MAPS_BROWSER_KEY?.trim() ?? "",
    mapId: process.env.GOOGLE_MAPS_MAP_ID?.trim() ?? "",
  };
  return (
    <MapsConfigProvider value={maps}>
      <AppShell>{children}</AppShell>
    </MapsConfigProvider>
  );
}
