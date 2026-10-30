import { withUser, json } from "@/lib/http";
import { confirmReport } from "@/lib/reports";

type Ctx = { params: Promise<{ id: string }> };

/** POST — "I see this too": adds the user to the report's confirmations. */
export const POST = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json(await confirmReport(user, id));
});
