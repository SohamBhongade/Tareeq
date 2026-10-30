import { withUser, json } from "@/lib/http";
import { adminAction, type AdminAction } from "@/lib/reports";

type Ctx = { params: Promise<{ id: string }> };

/** City Admin: { action: "dispatch" | "resolve" | "reject" } */
export const POST = withUser(async (user, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const report = await adminAction(user, id, String(body.action) as AdminAction);
  return json({ report });
});
