"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CodeInput, DemoCodeNote, ErrorNote, PasswordInput, RememberToggle, ResendButton, Spinner,
  fieldClass, labelClass, post, primaryButton,
} from "@/components/auth/fields";
import { useI18n } from "@/lib/i18n/client";

interface CodeSent { email: string; emailed: boolean; demoCode?: string; resendInSeconds: number }

const USERNAME_RULE = /^[A-Za-z0-9_.]{3,20}$/;

export function SignupFlow() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState<"form" | "code">("form");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = USERNAME_RULE.test(username);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nameOk) return setError(t("auth.badUsername"));
    if (password.length < 8) return setError(t("auth.shortPassword"));
    setBusy(true);
    try {
      setSent(await post<CodeSent>("/api/auth/signup", { username, email, password }));
      setCode("");
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth/verify", { email: sent?.email ?? email, code: value, remember });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setCode("");
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      setSent(await post<CodeSent>("/api/auth/resend", { email: sent?.email ?? email, purpose: "signup" }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (step === "code") {
    return (
      <div className="mt-7 short:mt-5">
        <div className="rounded-xl bg-surface-high px-4 py-3 text-[13px] text-ink-2">
          {sent?.emailed ? t("auth.sentTo") : t("auth.codeFor")}
          <b className="text-ink" dir="ltr">{sent?.email}</b>
          {sent?.emailed ? t("auth.checkSpam") : ""}
        </div>
        <DemoCodeNote code={sent?.demoCode} />

        <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="mt-5">
          <span className={labelClass}>{t("auth.enterCode")}</span>
          <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
          <ErrorNote text={error} />
          <button disabled={busy || code.length !== 6} className={`${primaryButton} mt-6 short:mt-4`}>
            {busy && <Spinner />}
            {busy ? t("auth.creating") : t("auth.verify")}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={() => { setStep("form"); setError(null); }}
            className="text-[13px] font-medium text-ink-2 hover:text-ink hover:underline"><span className="inline-block rtl:-scale-x-100">←</span> {t("auth.changeDetails")}</button>
          <ResendButton seconds={sent?.resendInSeconds ?? 45} onResend={resend} />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={start} className="mt-7 short:mt-5">
      <label htmlFor="su-name" className={labelClass}>{t("auth.username")}</label>
      <input id="su-name" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value.trim())}
        placeholder={t("auth.usernamePh")} maxLength={20} dir="ltr" className={`${fieldClass} mt-1.5`} required />
      <p className={`mt-1 text-[12px] ${username && !nameOk ? "text-critical" : "text-ink-4"}`}>
        {t("auth.usernameHint")}
      </p>

      <label htmlFor="su-email" className={`${labelClass} mt-3`}>{t("auth.email")}</label>
      <input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder={t("auth.emailPh")} dir="ltr" className={`${fieldClass} mt-1.5`} required />

      <label htmlFor="su-pass" className={`${labelClass} mt-3`}>{t("auth.password")}</label>
      <PasswordInput id="su-pass" value={password} onChange={setPassword} placeholder={t("auth.newPasswordPh")} autoComplete="new-password" />

      <div className="mt-4 short:mt-3">
        <RememberToggle checked={remember} onChange={setRemember} />
      </div>

      <ErrorNote text={error} />

      <button disabled={busy} className={`${primaryButton} mt-5 short:mt-4`}>
        {busy && <Spinner />}
        {busy ? t("auth.sendingCode") : t("auth.createBtn")}
      </button>

      <p className="mt-4 text-center text-[13px] text-ink-3">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-ink underline-offset-2 hover:underline">{t("auth.signIn")}</Link>
      </p>
    </form>
  );
}
