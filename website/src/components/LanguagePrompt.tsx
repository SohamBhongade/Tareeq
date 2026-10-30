"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { chooseLanguage, useI18n } from "@/lib/i18n/client";
import type { Lang } from "@/lib/i18n";

const OPTIONS: { lang: Lang; glyph: string; name: string; hint: string }[] = [
  { lang: "en", glyph: "Aa", name: "English", hint: "Continue in English" },
  { lang: "ar", glyph: "ع", name: "العربية", hint: "المتابعة بالعربية" },
];

/**
 * Pops up right after signing in: English or Arabic.
 * Written in both languages, because we don't know yet which one the person reads.
 */
export function LanguagePrompt() {
  const { lang } = useI18n();
  const [picked, setPicked] = useState<Lang>(lang);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const groupRef = useRef<HTMLDivElement>(null);

  // Lock page scrolling only while the popup is open. (It hides itself without
  // unmounting, so the lock must be released when `open` turns false.)
  useEffect(() => {
    if (!open) return;
    groupRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev === "hidden" ? "" : prev; };
  }, [open]);

  async function go(choice: Lang = picked) {
    setBusy(true);
    if (choice === lang) {
      // Same language as now: just close the prompt, no reload needed.
      await fetch("/api/lang", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: choice }) }).catch(() => {});
      setOpen(false);
      return;
    }
    await chooseLanguage(choice);
  }

  if (!open) return null;

  return (
    <div className="lang-backdrop fixed inset-0 z-[1300] grid place-items-center bg-black/35 dark:bg-black/60 p-4 backdrop-blur-[6px]"
      onKeyDown={(e) => { if (e.key === "Escape" && !busy) go(lang); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="lang-title"
        className="lang-card w-full max-w-[400px] rounded-[28px] bg-surface p-6 shadow-[0_24px_80px_-24px_rgb(41_41_40/0.45)] sm:p-7" dir="ltr">
        <div className="flex items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-on-lime">
            <Icon name="globe" size={24} />
          </span>
          <div className="min-w-0">
            <h2 id="lang-title" className="text-[19px] font-semibold leading-tight tracking-tight">Choose your language</h2>
            <p className="mt-0.5 text-[17px] font-medium leading-tight text-ink-2" lang="ar" dir="rtl" style={{ textAlign: "left" }}>اختر لغتك</p>
          </div>
        </div>

        <div ref={groupRef} role="radiogroup" aria-labelledby="lang-title" className="mt-6 space-y-2.5"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const next: Lang = picked === "en" ? "ar" : "en";
              setPicked(next);
              groupRef.current?.querySelector<HTMLButtonElement>(`[data-lang="${next}"]`)?.focus();
            }
          }}>
          {OPTIONS.map((o) => {
            const on = picked === o.lang;
            return (
              <button key={o.lang} type="button" role="radio" aria-checked={on} data-lang={o.lang} tabIndex={on ? 0 : -1}
                onClick={() => setPicked(o.lang)} onDoubleClick={() => go(o.lang)}
                className={`flex w-full items-center gap-3.5 rounded-[18px] border-[1.5px] p-3.5 text-left transition-all ${
                  on ? "border-ink bg-surface shadow-[0_6px_20px_-12px_rgb(41_41_40/0.5)]" : "border-line bg-surface-high hover:border-ink/30"
                }`}>
                <span lang={o.lang} className={`grid size-11 shrink-0 place-items-center rounded-[13px] text-[18px] font-semibold transition-colors ${on ? "bg-fill text-fill-accent" : "bg-surface text-ink"}`}>
                  {o.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span lang={o.lang} className="block text-[15.5px] font-semibold">{o.name}</span>
                  <span lang={o.lang} className="block text-[12.5px] text-ink-3">{o.hint}</span>
                </span>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] transition-all ${on ? "border-ink bg-lime text-on-lime" : "border-ink/20"}`}>
                  {on && <Icon name="check" size={14} />}
                </span>
              </button>
            );
          })}
        </div>

        <button type="button" onClick={() => go()} disabled={busy}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-fill text-[15px] font-semibold text-on-fill transition-colors hover:bg-fill-hover disabled:opacity-60">
          {busy && <span className="spin size-4 rounded-full border-2 border-white/30 border-t-white" />}
          {picked === "ar" ? "متابعة" : "Continue"}
        </button>
        <p className="mt-3 text-center text-[12px] text-ink-4">
          {picked === "ar" ? "يمكنك تغييرها لاحقاً بزر ع / EN." : "You can switch any time with the ع / EN button."}
        </p>
      </div>
    </div>
  );
}

/** Small switch: shows "ع" in English mode and "EN" in Arabic mode. */
export function LanguageToggle({ className = "", wide = false, compact = false }: { className?: string; wide?: boolean; compact?: boolean }) {
  const { lang, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const other: Lang = lang === "ar" ? "en" : "ar";
  return (
    <button type="button" disabled={busy} title={t("lang.switchLabel")} aria-label={t("lang.switchLabel")}
      onClick={async () => { setBusy(true); await chooseLanguage(other); }}
      className={`grid place-items-center rounded-[14px] font-semibold text-ink-2 transition-colors hover:bg-surface-high hover:text-ink disabled:opacity-50 ${
        wide ? "h-9 rounded-full border border-line bg-surface px-3 text-[13px]" : compact ? "size-10 !rounded-full text-[14px]" : "size-11 text-[15px]"
      } ${className}`}>
      {busy ? <span className="spin size-4 rounded-full border-2 border-ink/20 border-t-ink" /> : wide ? t("lang.switchTo") : other === "ar" ? "ع" : "EN"}
    </button>
  );
}
