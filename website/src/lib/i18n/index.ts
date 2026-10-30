import { BADGE_AR, CATEGORY_AR, ERROR_AR, ERROR_PATTERNS_AR, M, type MessageKey } from "./messages";

export type Lang = "en" | "ar";
export const LANGS: Lang[] = ["en", "ar"];

/** Cookie holding the chosen language. */
export const LANG_COOKIE = "tareeq_lang";
/** Set at sign-in so the language picker pops up once. */
export const LANG_PROMPT_COOKIE = "tareeq_lang_prompt";

export const parseLang = (v: unknown): Lang => (v === "ar" ? "ar" : "en");

/** Western digits in both languages (common in the UAE and easier to read alongside EXP). */
const LOCALE: Record<Lang, string> = { en: "en-GB", ar: "ar-AE-u-nu-latn" };

export type Vars = Record<string, string | number>;

function fill(s: string, vars?: Vars) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`)) : s;
}

export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const pair = M[key] as readonly [string, string];
  return fill(pair[lang === "ar" ? 1 : 0], vars);
}

/** Server error text → the user's language. */
export function translateError(lang: Lang, message: string): string {
  if (lang !== "ar" || !message) return message;
  if (ERROR_AR[message]) return ERROR_AR[message];
  for (const [rx, make] of ERROR_PATTERNS_AR) {
    const m = message.match(rx);
    if (m) return make(m);
  }
  return message;
}

/** Everything a page needs to show text in one language. */
export function makeI18n(lang: Lang) {
  const t = (key: MessageKey, vars?: Vars) => translate(lang, key, vars);
  const ar = lang === "ar";
  return {
    lang,
    dir: (ar ? "rtl" : "ltr") as "rtl" | "ltr",
    ar,
    t,
    /** Issue category display name. */
    cat: (c: string) => (ar ? CATEGORY_AR[c] ?? c : c),
    status: (s: string) => t(`status.${s}` as MessageKey),
    band: (b: string) => t(`band.${b}` as MessageKey),
    priority: (p: string) => t(`priority.${p}` as MessageKey),
    badgeName: (b: { id: string; name: string }) => (ar ? BADGE_AR[b.id]?.name ?? b.name : b.name),
    badgeBlurb: (b: { id: string; blurb: string }) => (ar ? BADGE_AR[b.id]?.blurb ?? b.blurb : b.blurb),
    /** Report description — the AI's Arabic version when there is one. */
    desc: (r: { description: string; descriptionAr?: string | null }) => (ar && r.descriptionAr ? r.descriptionAr : r.description),
    exp: (n: number) => t("common.expN", { n }),
    error: (msg: string) => translateError(lang, msg),
    timeAgo: (iso: string) => {
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (s < 60) return t("time.justNow");
      if (s < 3600) return t("time.min", { n: Math.floor(s / 60) });
      if (s < 86400) return t("time.hour", { n: Math.floor(s / 3600) });
      const d = Math.floor(s / 86400);
      if (d < 7) return d === 1 ? t("time.day", { n: d }) : t("time.days", { n: d });
      return new Date(iso).toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short" });
    },
    day: (iso: string) => new Date(iso).toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short" }),
    time: (iso: string) => new Date(iso).toLocaleTimeString(LOCALE[lang], { hour: "2-digit", minute: "2-digit" }),
  };
}

export type I18n = ReturnType<typeof makeI18n>;
export type { MessageKey };
