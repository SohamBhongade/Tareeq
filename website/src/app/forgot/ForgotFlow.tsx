"use client";
import Link from "next/link";
import { useState } from "react";
import {
  CodeInput, DemoCodeNote, ErrorNote, PasswordInput, ResendButton, Spinner,
  fieldClass, labelClass, post, primaryButton,
} from "@/components/auth/fields";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/lib/i18n/client";

interface CodeSent { email: string; emailed: boolean; demoCode?: string; resendInSeconds: number }

export function ForgotFlow() {
  const { t } = useI18n();
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent(await post<CodeSent>("/api/auth/forgot", { email }));
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setError(t("auth.needCode"));
    if (password.length < 8) return setError(t("auth.needNewPassword"));
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth/reset", { email, code, password });
      setStep("done");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <div className="mt-7 short:mt-5">
        <div className="flex items-start gap-3 rounded-xl bg-lime/40 px-4 py-3.5 text-sm text-ink">
          <Icon name="check" size={18} className="mt-0.5 shrink-0" />
          <span>{t("auth.changed")}</span>
        </div>
        <Link href="/login" className={`${primaryButton} mt-6`}>{t("auth.goSignIn")}</Link>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={reset} className="mt-7 short:mt-5">
        <div className="rounded-xl bg-surface-high px-4 py-3 text-[13px] text-ink-2">
          {t("auth.ifAccount", { email })}
        </div>
        <DemoCodeNote code={sent?.demoCode} />

        <span className={`${labelClass} mt-5`}>{t("auth.code")}</span>
        <CodeInput value={code} onChange={setCode} disabled={busy} />

        <label htmlFor="fp-pass" className={`${labelClass} mt-4`}>{t("auth.newPassword")}</label>
        <PasswordInput id="fp-pass" value={password} onChange={setPassword} placeholder={t("auth.newPasswordPh")} autoComplete="new-password" />

        <ErrorNote text={error} />
        <button disabled={busy} className={`${primaryButton} mt-6 short:mt-4`}>
          {busy && <Spinner />}
          {busy ? t("auth.saving") : t("auth.setPassword")}
        </button>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={() => { setStep("email"); setError(null); setCode(""); }}
            className="text-[13px] font-medium text-ink-2 hover:text-ink hover:underline"><span className="inline-block rtl:-scale-x-100">←</span> {t("auth.differentEmail")}</button>
          <ResendButton seconds={sent?.resendInSeconds ?? 45} onResend={async () => {
            try { setSent(await post<CodeSent>("/api/auth/resend", { email, purpose: "reset" })); }
            catch (err) { setError((err as Error).message); }
          }} />
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={send} className="mt-7 short:mt-5">
      <label htmlFor="fp-email" className={labelClass}>{t("auth.email")}</label>
      <input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder={t("auth.forgotEmailPh")} className={`${fieldClass} mt-1.5`} required />
      <ErrorNote text={error} />
      <button disabled={busy} className={`${primaryButton} mt-6 short:mt-4`}>
        {busy && <Spinner />}
        {busy ? t("auth.sending") : t("auth.emailMe")}
      </button>
      <p className="mt-4 text-center text-[13px] text-ink-3">
        {t("auth.remembered")} <Link href="/login" className="font-semibold text-ink underline-offset-2 hover:underline">{t("auth.backToSignIn")}</Link>
      </p>
      <p className="mt-2 text-center text-[12px] text-ink-4">{t("auth.demoNoEmail")}</p>
    </form>
  );
}
