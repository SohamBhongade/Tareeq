import { withUser, json } from "@/lib/http";
import { loadUser } from "@/lib/reports";

export const GET = withUser(async (session) => json({ user: await loadUser(session) }));
