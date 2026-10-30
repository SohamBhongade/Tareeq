import { withUser, json, fail } from "@/lib/http";
import { chooseAvatar } from "@/lib/reports";

/** POST { avatar } — set the current user's avatar (must be unlocked). */
export const POST = withUser(async (user, req: Request) => {
  const body = await req.json().catch(() => ({}));
  if (typeof body.avatar !== "string") return fail("Missing avatar.");
  return json({ user: await chooseAvatar(user, body.avatar) });
});
