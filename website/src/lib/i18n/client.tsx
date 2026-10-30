"use client";
import { createContext, useContext, useMemo } from "react";
import { makeI18n, type Lang } from "./index";

const Ctx = createContext(makeI18n("en"));

/** Wraps the whole site (root layout) with the chosen language. */
export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => makeI18n(lang), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** In client components: const { t, cat, status, … } = useI18n(); */
export const useI18n = () => useContext(Ctx);

/** Saves the language and reloads so the whole page (and its direction) switches. */
export async function chooseLanguage(lang: Lang) {
  await fetch("/api/lang", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang }),
  }).catch(() => {});
  window.location.reload();
}
