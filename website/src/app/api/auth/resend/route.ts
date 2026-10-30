import { json, publicRoute } from "@/lib/http";
import { getLang } from "@/lib/i18n/server";
import { resendSignup, startReset } from "@/lib/accounts";

/** { email, purpose: "signup" | "reset" } → sends a fresh code. */
export const POST = publicRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const lang = await getLang();
  return json(body.purpose === "reset" ? await startReset(body, lang) : await resendSignup(body, lang));
});
