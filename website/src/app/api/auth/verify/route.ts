import { json, publicRoute } from "@/lib/http";
import { finishSignup } from "@/lib/accounts";
import { startSession } from "@/lib/auth";
import { askForLanguage } from "@/lib/i18n/server";

/** Step 2: { email, code, remember } → creates the account and signs in. */
export const POST = publicRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const user = await finishSignup(body);
  await startSession(user, body.remember === true);
  await askForLanguage();
  return json({ user });
});
