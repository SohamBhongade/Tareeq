"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

const LINKS: { href: string; label: MessageKey; short: MessageKey; icon: string }[] = [
  { href: "/", label: "nav.map", short: "nav.mapShort", icon: "home" },
  { href: "/report", label: "nav.report", short: "nav.reportShort", icon: "camera" },
  { href: "/issues", label: "nav.issues", short: "nav.issuesShort", icon: "grid" },
  { href: "/leaderboard", label: "nav.leaderboard", short: "nav.leaderboardShort", icon: "trophy" },
  { href: "/rewards", label: "nav.rewards", short: "nav.rewardsShort", icon: "award" },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

/** Desktop: icon-only rail with a tooltip label on hover. */
export function RailLinks() {
  const isActive = useActive();
  const { t } = useI18n();
  return (
    <nav aria-label={t("nav.main")} className="flex flex-col items-center gap-2">
      {LINKS.map((l) => {
        const active = isActive(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-label={t(l.label)}
            aria-current={active ? "page" : undefined}
            className={`group relative grid size-11 place-items-center rounded-[14px] transition-colors ${
              active ? "bg-night text-ink" : "text-ink-3 hover:bg-surface-high hover:text-ink"
            }`}
          >
            <Icon name={l.icon} size={20} />
            {active && <span className="absolute -start-[10px] h-5 w-1 rounded-e-full bg-lime" aria-hidden />}
            <span className="pointer-events-none absolute start-full ms-3 whitespace-nowrap rounded-lg bg-fill px-2.5 py-1 text-xs font-medium text-on-fill opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {t(l.label)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Phones and tablets: bottom tab bar. */
export function MobileTabs() {
  const isActive = useActive();
  const { t } = useI18n();
  return (
    <div className="mx-auto grid max-w-md grid-cols-5 px-1 pb-1.5 pt-2">
      {LINKS.map((l) => {
        const active = isActive(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-1 text-[10.5px] font-medium transition-colors ${active ? "text-ink" : "text-ink-3"}`}
          >
            <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors duration-200 ${active ? "bg-fill text-fill-accent" : ""}`}>
              <Icon name={l.icon} size={20} />
            </span>
            {t(l.short)}
          </Link>
        );
      })}
    </div>
  );
}

export function SignOutButton({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <button
      type="button"
      aria-label={t("common.signOut")}
      title={t("common.signOut")}
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
      className={
        iconOnly
          ? `grid size-11 place-items-center rounded-[14px] text-ink-3 hover:bg-surface-high hover:text-critical ${className}`
          : `items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-ink-3 hover:bg-ink/[0.05] hover:text-ink ${className}`
      }
    >
      <Icon name="logout" size={iconOnly ? 19 : 16} className="rtl:-scale-x-100" />
      {!iconOnly && t("common.signOut")}
    </button>
  );
}
