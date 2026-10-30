import { checkCredentials, startSession } from "@/lib/auth";
import { json, fail, publicRoute } from "@/lib/http";
import { askForLanguage } from "@/lib/i18n/server";

/** { username (or email), password, remember } */
export const POST = publicRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const user = await checkCredentials(String(body.username ?? ""), String(body.password ?? ""));
  if (!user) return fail("Incorrect username, email or password.", 401);
  await startSession(user, body.remember === true);
  await askForLanguage();
  return json({ user });
});
