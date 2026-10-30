"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { ErrorNote, PasswordInput, RememberToggle, Spinner, fieldClass, labelClass, post, primaryButton } from "@/components/auth/fields";

const DEMOS = [
  { label: "auth.demoResident", username: "Resident1", password: "123" },
  { label: "auth.demoAdmin", username: "CityAdmin", password: "12345" },
] as const;

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(u: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      await post("/api/login", { username: u, password: p, remember });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); signIn(username, password); }} className="mt-7 short:mt-5">
      <label htmlFor="u" className={labelClass}>{t("auth.userOrEmail")}</label>
      <input id="u" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)}
        placeholder={t("auth.userOrEmailPh")} className={`${fieldClass} mt-1.5`} required />

      <label htmlFor="p" className={`${labelClass} mt-4 short:mt-3`}>{t("auth.password")}</label>
      <PasswordInput id="p" value={password} onChange={setPassword} />

      <div className="mt-4 flex items-center justify-between short:mt-3">
        <RememberToggle checked={remember} onChange={setRemember} />
        <Link href="/forgot" className="text-[13px] font-medium text-ink-2 hover:text-ink hover:underline">{t("auth.forgot")}</Link>
      </div>

      <ErrorNote text={error} />

      <button disabled={busy} className={`${primaryButton} mt-6 short:mt-4`}>
        {busy && <Spinner />}
        {busy ? t("auth.signingIn") : t("auth.signIn")}
      </button>

      <p className="mt-4 text-center text-[13px] text-ink-3">
        {t("auth.newHere")}{" "}
        <Link href="/signup" className="font-semibold text-ink underline-offset-2 hover:underline">{t("auth.create")}</Link>
      </p>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-4 short:my-4">
        <span className="h-px flex-1 bg-line" /> {t("auth.demoOr")} <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {DEMOS.map((d) => (
          <button key={d.username} type="button" disabled={busy}
            onClick={() => { setUsername(d.username); setPassword(d.password); signIn(d.username, d.password); }}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm font-medium transition-colors hover:border-ink disabled:opacity-60">
            <span className="size-2 rounded-full bg-lime ring-1 ring-ink/20" />
            {t(d.label)}
          </button>
        ))}
      </div>
    </form>
  );
}
