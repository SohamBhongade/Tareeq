import { listReports } from "@/lib/reports";
import { HomeView } from "./HomeView";

export default async function HomePage() {
  const reports = await listReports();
  return <HomeView initial={reports} />;
}
