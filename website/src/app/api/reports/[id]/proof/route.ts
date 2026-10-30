import { withUser, json, fail, cleanImage } from "@/lib/http";
import { submitProof } from "@/lib/reports";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser(async (user, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const img = cleanImage(body.imageBase64);
  if (!img) return fail("Please attach a photo under 6 MB.");
  const dataUri = `data:${img.mime};base64,${img.base64}`;
  return json({ report: await submitProof(user, id, dataUri) });
});
