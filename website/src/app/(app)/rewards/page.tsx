import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { loadUser, listReports } from "@/lib/reports";
import { SignOutButton } from "@/components/NavLinks";
import { Icon } from "@/components/Icon";
import { currentBadge, nextBadge } from "@/lib/badges";
import Link from "next/link";
import { getI18n, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = () => pageTitle("rewards.title");

export default async function RewardsPage() {
  const user = await loadUser(await requireUser());
  const i18n = await getI18n();
  const { t } = i18n;
  const reports = await listReports();
  const fixedByMe = reports.filter((r) => r.status === "resolved" && r.assignedVolunteerId === user.username).length;
  const activeTasks = reports.filter((r) => r.assignedVolunteerId === user.username && r.status !== "resolved").length;
  const badge = currentBadge(user.currentExp);
  const next = nextBadge(user.currentExp);
  const pct = next ? Math.round(((user.currentExp - badge.minExp) / (next.minExp - badge.minExp)) * 100) : 100;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">{t("rewards.title")}</h1>
        <p className="mt-1 text-[13.5px] text-ink-2 sm:text-sm">{t("rewards.subtitle")}</p>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime/45 text-olive sm:size-14"><Icon name="award" size={26} /></span>
          <div className="min-w-0 flex-1">
            <div className="label truncate">{t("rewards.balance")}</div>
            <div className="whitespace-nowrap text-[28px] font-bold leading-tight tabular-nums sm:text-3xl">{user.currentExp} <span className="text-base font-semibold text-olive sm:text-lg">{t("common.exp")}</span></div>
          </div>
          <div className="flex basis-full items-baseline justify-between gap-2 border-t border-line pt-3 sm:block sm:basis-auto sm:border-0 sm:pt-0 sm:text-end">
            <div className="label">{user.role === "cityAdmin" ? t("rewards.role") : t("rewards.rank")}</div>
            <div className="font-semibold">{user.role === "cityAdmin" ? t("common.cityAdmin") : `${badge.emoji} ${i18n.badgeName(badge)}`}</div>
          </div>
        </div>
        <div className="mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-overlay">
            <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-ink-3">
            <span>{next ? t("rewards.pctTo", { pct, badge: `${next.emoji} ${i18n.badgeName(next)}` }) : t("rewards.top")}</span>
            <span className="tabular-nums">{next ? t("rewards.toGo", { n: next.minExp - user.currentExp }) : ""}</span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-line bg-elevated px-3 py-2.5"><div className="label">{t("rewards.fixed")}</div><div className="mt-0.5 text-lg font-semibold tabular-nums">{fixedByMe}</div></div>
          <div className="rounded-xl border border-line bg-elevated px-3 py-2.5"><div className="label">{t("rewards.active")}</div><div className="mt-0.5 text-lg font-semibold tabular-nums">{activeTasks}</div></div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { img: "/brand/volunteer.jpg", tag: t("rewards.volTag"), title: t("rewards.volTitle"), exp: t("common.plusExp", { n: 250 }), body: t("rewards.volBody") },
          { img: "/brand/report.jpg", tag: t("rewards.repTag"), title: t("rewards.repTitle"), exp: t("common.plusExp", { n: 50 }), body: t("rewards.repBody") },
        ].map((c) => (
          <div key={c.title} className="card overflow-hidden">
            <div className="relative h-40">
              <Image src={c.img} alt="" fill sizes="(min-width: 640px) 380px, 100vw" className="object-cover" />
              <span className="absolute start-3 top-3 rounded-full border border-white/20 bg-black/40 text-white px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">{c.tag}</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{c.title}</h2>
                <span className="rounded-full border border-olive/40 px-2.5 py-0.5 text-xs font-semibold text-olive">{c.exp}</span>
              </div>
              <p className="mt-1 text-sm text-ink-2">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <span className="text-ink-2">💬 {t("rewards.confirmNote")}</span>
        <Link href="/profile" className="rounded-xl bg-fill px-4 py-2 font-semibold text-on-fill hover:bg-fill-hover">{t("rewards.badgesBtn")}</Link>
      </div>

      <div className="flex justify-center pt-2 lg:hidden">
        <SignOutButton className="inline-flex border border-critical/30 text-critical" />
      </div>
    </div>
  );
}
