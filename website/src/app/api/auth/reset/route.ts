import { json, publicRoute } from "@/lib/http";
import { finishReset } from "@/lib/accounts";

/** { email, code, password } → sets the new password. */
export const POST = publicRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  await finishReset(body);
  return json({ ok: true });
});
