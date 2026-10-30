import { json, publicRoute } from "@/lib/http";
import { getLang } from "@/lib/i18n/server";
import { startSignup } from "@/lib/accounts";

/** Step 1: { username, email, password } → emails a 6-digit code. */
export const POST = publicRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return json(await startSignup(body, await getLang()));
});
