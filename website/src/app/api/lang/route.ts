import { cookies } from "next/headers";
import { json } from "@/lib/http";
import { LANG_COOKIE, LANG_PROMPT_COOKIE, parseLang } from "@/lib/i18n";

/** { lang: "en" | "ar" } → remembers the language (1 year) and closes the sign-in language prompt. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lang = parseLang(body.lang);
  const jar = await cookies();
  jar.set(LANG_COOKIE, lang, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  jar.delete(LANG_PROMPT_COOKIE);
  return json({ lang });
}
