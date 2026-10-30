import { json, publicRoute } from "@/lib/http";
import { getLang } from "@/lib/i18n/server";
import { startReset } from "@/lib/accounts";

/** { email } → emails a reset code (if an account uses that email). */
export const POST = publicRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return json(await startReset(body, await getLang()));
});
