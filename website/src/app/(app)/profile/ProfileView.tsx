"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarImg } from "@/components/AvatarImg";
import { Icon } from "@/components/Icon";
import { SignOutButton } from "@/components/NavLinks";
import { useToast } from "@/components/Toast";
import { api } from "@/components/imageUtil";
import { AVATARS, DEFAULT_AVATAR, RARITY_STYLE, avatarUrl, isUnlocked, type Avatar } from "@/lib/avatars";
import { BADGES, currentBadge, nextBadge } from "@/lib/badges";
import type { AppUser } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";

interface Stats { reported: number; confirmed: number; fixed: number; rank: number | null }

export function ProfileView({ user, stats }: { user: AppUser; stats: Stats }) {
  const router = useRouter();
  const toast = useToast();
  const i18n = useI18n();
  const { t } = i18n;
  const [selected, setSelected] = useState(user.avatar ?? DEFAULT_AVATAR);
  const [saving, setSaving] = useState<string | null>(null);

  const exp = user.currentExp;
  const badge = currentBadge(exp);
  const next = nextBadge(exp);
  const pct = next ? Math.round(((exp - badge.minExp) / (next.minExp - badge.minExp)) * 100) : 100;
  const free = AVATARS.filter((a) => a.unlockExp === 0);
  const unlockable = AVATARS.filter((a) => a.unlockExp > 0);
  const unlockedCount = unlockable.filter((a) => isUnlocked(a, exp)).length;

  async function pick(a: Avatar) {
    if (!isUnlocked(a, exp)) {
      toast(t("profile.lockedToast", { n: a.unlockExp, left: a.unlockExp - exp }), "warn");
      return;
    }
    if (a.id === selected) return;
    const prev = selected;
    setSelected(a.id);
    setSaving(a.id);
    try {
      await api("/api/profile/avatar", { json: { avatar: a.id } });
      toast(t("profile.updated"));
      router.refresh();
    } catch (e) {
      setSelected(prev);
      toast((e as Error).message, "error");
    } finally {
      setSaving(null);
    }
  }

  const tile = (a: Avatar) => {
    const unlocked = isUnlocked(a, exp);
    const active = a.id === selected;
    const r = RARITY_STYLE[a.rarity];
    return (
      <li key={a.id}>
        <button
          type="button"
          onClick={() => pick(a)}
          aria-pressed={active}
          aria-label={`${a.name}${unlocked ? "" : `, ${t("profile.locked", { n: a.unlockExp })}`}`}
          className={`group relative w-full rounded-2xl border p-1.5 text-center transition ${
            active ? "border-olive bg-lime/30" : "border-line bg-surface hover:border-olive/40"
          }`}
        >
          <span className="relative block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl(a.id)}
              alt=""
              className={`aspect-square w-full rounded-xl object-cover ${a.rarity !== "free" ? `ring-2 ${r.ring}` : ""} ${
                unlocked ? "" : "opacity-40 grayscale"
              }`}
            />
            {!unlocked && (
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-9 place-items-center rounded-full bg-surface/85 text-ink">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
              </span>
            )}
            {active && (
              <span className="absolute -end-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-fill text-on-fill">
                {saving === a.id ? <span className="spin size-3 rounded-full border-2 border-white/30 border-t-white" /> : <Icon name="check" size={14} />}
              </span>
            )}
          </span>
          {!unlocked && (
            <span className={`mt-1.5 block text-[10px] font-semibold uppercase tracking-wide ${r.text}`}>{i18n.exp(a.unlockExp)}</span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <section className="card flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center">
        <AvatarImg id={selected} size={104} />
        <div className="flex-1 text-center sm:text-start">
          <h1 className="text-2xl font-semibold tracking-tight">{user.username}</h1>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-start">
            <span className="rounded-full border border-line px-2.5 py-0.5 text-ink-2">{user.role === "cityAdmin" ? t("common.cityAdmin") : t("common.resident")}</span>
            <span className="rounded-full border border-olive/40 bg-lime/30 px-2.5 py-0.5 text-olive">{badge.emoji} {i18n.badgeName(badge)}</span>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold tabular-nums">{i18n.exp(exp)}</span>
              <span className="text-xs text-ink-3">
                {next ? t("profile.toNext", { n: next.minExp - exp, badge: `${next.emoji} ${i18n.badgeName(next)}` }) : t("profile.top")}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-overlay">
              <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t("profile.rank"), stats.rank ? `#${stats.rank}` : "—"],
          [t("profile.reported"), stats.reported],
          [t("profile.confirmed"), stats.confirmed],
          [t("profile.fixed"), stats.fixed],
        ].map(([l, v]) => (
          <div key={l as string} className="card px-4 py-3.5">
            <div className="label">{l}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </section>

      {/* Badges */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("profile.badges")}</h2>
          <span className="text-xs text-ink-3">{t("profile.earned", { n: BADGES.filter((b) => exp >= b.minExp).length, total: BADGES.length })}</span>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BADGES.map((b) => {
            const earned = exp >= b.minExp;
            return (
              <li key={b.id} className={`rounded-2xl border bg-gradient-to-br p-3 text-center ${earned ? b.tone : "border-line from-transparent to-transparent opacity-55"}`}>
                <div className={`text-3xl ${earned ? "" : "grayscale"}`} aria-hidden>{b.emoji}</div>
                <div className="mt-1 text-sm font-semibold">{i18n.badgeName(b)}</div>
                <div className="text-[11px] text-ink-3">{earned ? i18n.badgeBlurb(b) : t("profile.unlocksAt", { n: b.minExp })}</div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Avatars */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t("profile.avatarTitle")}</h2>
          <span className="text-xs text-ink-3">{t("profile.avatarHint")}</span>
        </div>
        <h3 className="label mt-4">{t("profile.free", { n: free.length })}</h3>
        <ul className="mt-2 grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8">{free.map(tile)}</ul>
        <h3 className="label mt-6">{t("profile.unlockable", { n: unlockedCount, total: unlockable.length })}</h3>
        <ul className="mt-2 grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8">{unlockable.map(tile)}</ul>
        <p className="mt-4 text-[11px] text-ink-4">{t("profile.credit")}</p>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-3 pb-2">
        <Link href="/leaderboard" className="rounded-xl border border-line px-4 py-2 text-sm hover:bg-ink/[0.05]">{t("profile.viewLb")}</Link>
        <Link href="/rewards" className="rounded-xl border border-line px-4 py-2 text-sm hover:bg-ink/[0.05]">{t("profile.howEarn")}</Link>
        <SignOutButton className="inline-flex border border-critical/30 text-critical" />
      </div>
    </div>
  );
}
