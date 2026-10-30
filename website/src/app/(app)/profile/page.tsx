import { requireUser } from "@/lib/auth";
import { getLeaderboard, listReports, loadUser } from "@/lib/reports";
import { ProfileView } from "./ProfileView";

import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = () => pageTitle("profile.metaTitle");

export default async function ProfilePage() {
  const session = await requireUser();
  const [user, reports, leaders] = await Promise.all([loadUser(session), listReports(), getLeaderboard(500)]);
  const stats = {
    reported: reports.filter((r) => r.reportedBy === user.username).length,
    confirmed: reports.filter((r) => r.confirmedBy.includes(user.username)).length,
    fixed: reports.filter((r) => r.status === "resolved" && r.assignedVolunteerId === user.username).length,
    rank: leaders.findIndex((r) => r.username === user.username) + 1 || null,
  };
  return <ProfileView user={user} stats={stats} />;
}
