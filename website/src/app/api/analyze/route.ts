import { withUser, json, fail, cleanImage } from "@/lib/http";
import { analyzeImage } from "@/lib/gemini";

export const maxDuration = 60;

export const POST = withUser(async (_user, req: Request) => {
  const body = await req.json().catch(() => ({}));
  const img = cleanImage(body.imageBase64);
  if (!img) return fail("Please attach a photo under 6 MB.");
  const analysis = await analyzeImage(img.base64, img.mime);
  return json({ analysis });
});
