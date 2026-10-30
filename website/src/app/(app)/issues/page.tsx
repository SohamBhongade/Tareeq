import { listReports } from "@/lib/reports";
import { ConsoleView } from "./ConsoleView";

import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = () => pageTitle("console.title");

export default async function IssuesPage() {
  return <ConsoleView initial={await listReports()} />;
}
