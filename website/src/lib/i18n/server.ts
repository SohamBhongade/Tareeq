import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, LANG_PROMPT_COOKIE, makeI18n, parseLang, type Lang } from "./index";

export async function getLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

/** In server components: const { t, cat, … } = await getI18n(); */
export async function getI18n() {
  return makeI18n(await getLang());
}

/** Called at sign-in: the language picker will pop up on the next page. */
export async function askForLanguage() {
  (await cookies()).set(LANG_PROMPT_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function shouldAskForLanguage(): Promise<boolean> {
  return (await cookies()).get(LANG_PROMPT_COOKIE)?.value === "1";
}

/** "<page> — Tareeq" in the user's language, for <title>. */
export async function pageTitle(key: import("./index").MessageKey) {
  const { t, ar } = await getI18n();
  return { title: `${t(key)} — ${ar ? "طريق" : "Tareeq"}` };
}
