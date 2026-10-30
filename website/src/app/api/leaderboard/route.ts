import { withUser, json } from "@/lib/http";
import { getLeaderboard } from "@/lib/reports";

export const GET = withUser(async () => json({ leaders: await getLeaderboard(50) }));
