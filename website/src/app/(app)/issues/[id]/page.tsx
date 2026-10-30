import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getReport } from "@/lib/reports";
import { IssueDetail } from "./IssueDetail";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, report] = await Promise.all([requireUser(), getReport(id)]);
  if (!report) notFound();
  return <IssueDetail initial={report} user={user} />;
}
