"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { translateError } from "@/lib/i18n";
import { pageLang } from "@/components/imageUtil";
import { useI18n } from "@/lib/i18n/client";

export const fieldClass =
  "h-12 short:h-11 w-full rounded-xl bg-surface-high px-4 text-[15px] text-ink outline-none ring-1 ring-transparent transition placeholder:text-ink-4 focus:bg-surface focus:ring-ink/25";
export const labelClass = "block text-[13px] font-medium text-ink-2";
export const primaryButton =
  "flex h-12 short:h-11 w-full items-center justify-center gap-2 rounded-xl bg-fill text-[15px] font-semibold text-on-fill transition-colors hover:bg-fill-hover disabled:opacity-60";

export function Spinner() {
  return <span className="spin size-4 rounded-full border-2 border-white/30 border-t-white" />;
}

export function ErrorNote({ text }: { text: string | null }) {
  if (!text) return null;
  return <p role="alert" className="mt-4 rounded-xl bg-critical/10 px-3.5 py-2.5 text-sm text-critical">{text}</p>;
}

export function PasswordInput({
  id, value, onChange, placeholder, autoComplete = "current-password",
}: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  return (
    <div className="relative mt-1.5">
      <input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} value={value}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? t("auth.passwordPh")} className={`${fieldClass} pe-12`} required />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("auth.hide") : t("auth.show")}
        className="absolute end-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:text-ink">
        <Icon name={show ? "eyeOff" : "eye"} size={19} />
      </button>
    </div>
  );
}

export function RememberToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { t } = useI18n();
  return (
    <label className="flex w-fit cursor-pointer select-none items-center gap-2.5 text-[13px] text-ink-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-5 w-9 rounded-full bg-surface-overlay transition-colors peer-checked:bg-fill peer-focus-visible:ring-2 peer-focus-visible:ring-ink/40 after:absolute after:start-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4" />
      {t("auth.remember")}
    </label>
  );
}

/** Six boxes for the email code. Supports typing, backspace, arrows and pasting the whole code. */
export function CodeInput({ value, onChange, onComplete, disabled }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const { t } = useI18n();
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const set = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
    refs.current[Math.min(clean.length, 5)]?.focus();
  };

  return (
    <div className="mt-2 flex gap-2" role="group" aria-label={t("auth.codeGroup")} dir="ltr">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={t("auth.digit", { n: i + 1 })}
          maxLength={6}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) return;
            if (typed.length > 1) return set(value.slice(0, i) + typed); // pasted or autofilled
            set((value.slice(0, i) + typed + value.slice(i + 1)).slice(0, 6));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (d) set(value.slice(0, i) + value.slice(i + 1));
              else if (i > 0) { set(value.slice(0, i - 1) + value.slice(i)); refs.current[i - 1]?.focus(); }
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => { e.preventDefault(); set(e.clipboardData.getData("text")); }}
          className="h-14 w-full min-w-0 rounded-xl bg-surface-high text-center text-[22px] font-semibold tabular-nums text-ink outline-none ring-1 ring-transparent transition focus:bg-surface focus:ring-ink/30 disabled:opacity-60 short:h-12"
        />
      ))}
    </div>
  );
}

/** "Send a new code" with a countdown. */
export function ResendButton({ seconds, onResend }: { seconds: number; onResend: () => Promise<void> }) {
  const [left, setLeft] = useState(seconds);
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLeft(seconds); }, [seconds]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <button type="button" disabled={left > 0 || busy}
      onClick={async () => { setBusy(true); try { await onResend(); } finally { setBusy(false); } }}
      className="text-[13px] font-medium text-ink underline-offset-2 hover:underline disabled:text-ink-4 disabled:no-underline">
      {busy ? t("auth.sending") : left > 0 ? t("auth.resendIn", { n: left }) : t("auth.resend")}
    </button>
  );
}

/** Shown only when the site has no Gmail set up, so testing still works. */
export function DemoCodeNote({ code }: { code?: string }) {
  const { t } = useI18n();
  if (!code) return null;
  return (
    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
      {t("auth.demoCode")}<b className="tabular-nums tracking-widest" dir="ltr">{code}</b>
    </p>
  );
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(translateError(pageLang(), j.error ?? "Something went wrong. Please try again."));
  return j as T;
}
