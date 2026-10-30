import { withUser, json } from "@/lib/http";
import { verifyAndResolve } from "@/lib/reports";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json(await verifyAndResolve(user, id));
});
