import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadUser } from "@/lib/reports";
import { getStore } from "@/lib/store";
import { aiConfigured } from "@/lib/gemini";
import { MobileTabs, RailLinks, SignOutButton } from "./NavLinks";
import { AvatarImg } from "./AvatarImg";
import { APP_NAME, LogoMark } from "./LogoMark";
import { currentBadge, nextBadge } from "@/lib/badges";
import { getI18n, shouldAskForLanguage } from "@/lib/i18n/server";
import { LanguagePrompt, LanguageToggle } from "./LanguagePrompt";
import { ThemeToggle } from "./ThemeToggle";

/** Avatar wrapped in a lime ring that fills up as you approach the next badge. */
function AvatarProgress({ avatar, pct, size = 44 }: { avatar: string | null; pct: number; size?: number }) {
  const box = size + 10;
  const r = box / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid place-items-center" style={{ width: box, height: box }}>
      <svg width={box} height={box} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" className="stroke-surface-overlay" strokeWidth={3} />
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="#c3f832" strokeWidth={3} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <AvatarImg id={avatar} size={size} ring={false} className="rounded-full" />
    </span>
  );
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const [user, i18n, askLang] = await Promise.all([loadUser(session), getI18n(), shouldAskForLanguage()]);
  const { t, badgeName } = i18n;
  const demoDb = getStore().mode === "memory";
  const demoAi = !aiConfigured();
  const badge = currentBadge(user.currentExp);
  const next = nextBadge(user.currentExp);
  const pct = next
    ? Math.min(100, Math.round(((user.currentExp - badge.minExp) / (next.minExp - badge.minExp)) * 100))
    : 100;
  const isAdmin = user.role === "cityAdmin";
  const demoText = [demoAi && t("common.demoAiLong"), demoDb && t("common.demoDbLong")].filter(Boolean).join(" · ");
  const who = `${user.username} · ${isAdmin ? t("common.cityAdmin") : `${i18n.exp(user.currentExp)} · ${badge.emoji} ${badgeName(badge)}`}`;
  const appName = i18n.ar ? "طريق" : APP_NAME;

  return (
    // --hdr = height of the phone header, used by pages that stick things under it.
    <div className="min-h-dvh" style={{ ["--hdr" as string]: `calc(${demoDb || demoAi ? 81 : 57}px + env(safe-area-inset-top))` }}>
      {/* ── Desktop: floating icon rail ─────────────────────────── */}
      <aside className="panel fixed bottom-3 start-3 top-3 z-[1100] hidden w-[64px] flex-col items-center py-4 lg:flex">
        <Link href="/" aria-label={`${appName} — ${t("common.home")}`} title={appName}>
          <LogoMark size={40} />
        </Link>
        <div className="flex flex-1 flex-col justify-center">
          <RailLinks />
        </div>
        <div className="flex flex-col items-center gap-1">
          <ThemeToggle />
          <LanguageToggle />
          {(demoDb || demoAi) && (
            <span title={`${t("common.demoMode")} — ${demoText}`} className="tag mb-1 bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
              {t("common.demo")}
            </span>
          )}
          <Link href="/profile" title={who} aria-label={t("common.openProfile")} className="rounded-full">
            <AvatarProgress avatar={user.avatar} pct={isAdmin ? 100 : pct} size={36} />
          </Link>
          <span className="text-[10.5px] font-semibold tabular-nums text-ink-2">{isAdmin ? t("common.admin") : i18n.exp(user.currentExp)}</span>
          <SignOutButton iconOnly className="mt-1" />
        </div>
      </aside>

      {/* ── Phones / tablets: top bar ───────────────────────────── */}
      <header className="sticky top-0 z-[1100] border-b border-line bg-surface/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 lg:hidden">
        <div className="flex h-14 items-center gap-1 ps-4 pe-2.5">
          <Link href="/" className="me-auto flex min-w-0 items-center gap-2.5" aria-label={`${appName} — ${t("common.home")}`}>
            <LogoMark size={32} />
            <span className="truncate text-[17px] font-semibold tracking-tight">{appName}</span>
          </Link>
          <ThemeToggle compact />
          <LanguageToggle compact />
          <Link href="/profile" title={who} aria-label={t("common.openProfile")} className="ms-0.5 rounded-full">
            <AvatarProgress avatar={user.avatar} pct={isAdmin ? 100 : pct} size={30} />
          </Link>
        </div>
        {(demoDb || demoAi) && (
          <div className="flex h-6 items-center justify-center gap-1 truncate border-t border-amber-200 bg-amber-50 px-4 text-[11px] text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
            <b>{t("common.demoMode")}</b> — <span className="truncate">{t("common.demoAiDb", { what: [demoAi && t("common.demoAi"), demoDb && t("common.demoDb")].filter(Boolean).join(t("common.and")) })}</span>
          </div>
        )}
      </header>

      <main className="w-full px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-5 md:px-6 lg:pb-10 lg:ps-[100px] lg:pe-8 lg:pt-7">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      {askLang && <LanguagePrompt />}

      <nav className="fixed inset-x-0 bottom-0 z-[1100] border-t border-line bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden">
        <MobileTabs />
      </nav>
    </div>
  );
}
