import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLeaderboard, loadUser } from "@/lib/reports";
import { currentBadge } from "@/lib/badges";
import { AvatarImg } from "@/components/AvatarImg";
import type { LeaderRow } from "@/lib/types";
import { getI18n, pageTitle } from "@/lib/i18n/server";
import type { I18n } from "@/lib/i18n";

export const generateMetadata = () => pageTitle("lb.title");

const MEDAL = ["🥇", "🥈", "🥉"];

function Podium({ row, place, me, i18n }: { row: LeaderRow; place: 0 | 1 | 2; me: string; i18n: I18n }) {
  const badge = currentBadge(row.currentExp);
  const tall = place === 0;
  return (
    <div className={`flex min-w-0 flex-col items-center text-center ${tall ? "order-2" : place === 1 ? "order-1 mt-8" : "order-3 mt-12"}`}>
      <div className="text-xl sm:text-2xl" aria-hidden>{MEDAL[place]}</div>
      <AvatarImg id={row.avatar} size={tall ? 96 : 76}
        className={`mt-1 ${tall ? "!size-[min(96px,22vw)] ring-4 ring-amber-300/80" : "!size-[min(76px,17vw)]"}`} />
      <div className="mt-2 w-full max-w-28 truncate text-[14px] font-semibold sm:text-base">
        {row.username}
        {row.username === me && <span className="ms-1 text-xs text-olive">{i18n.t("lb.you")}</span>}
      </div>
      <div className="w-full truncate text-[11px] text-ink-3 sm:text-xs">{badge.emoji} {i18n.badgeName(badge)}</div>
      <div className={`mt-2 w-full max-w-24 rounded-t-xl border border-b-0 border-line bg-surface-high pt-2 text-sm font-bold tabular-nums ${tall ? "h-20 text-amber-500" : place === 1 ? "h-14 text-ink" : "h-10 text-ink-2"}`}>
        {row.currentExp}
        <span className="ms-0.5 text-[10px] font-medium text-ink-3">{i18n.t("common.exp")}</span>
      </div>
    </div>
  );
}

export default async function LeaderboardPage() {
  const session = await requireUser();
  const [me, leaders, i18n] = await Promise.all([loadUser(session), getLeaderboard(100), getI18n()]);
  const { t } = i18n;
  const myRank = leaders.findIndex((r) => r.username === me.username);
  const top = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">{t("lb.title")}</h1>
          <p className="mt-1 text-[13.5px] text-ink-2 sm:text-sm">{t("lb.subtitle")}</p>
        </div>
        {myRank >= 0 ? (
          <div className="rounded-full border border-olive/40 bg-lime/30 px-3 py-1.5 text-sm">
            {t("lb.rank", { rank: myRank + 1, total: leaders.length })}
          </div>
        ) : (
          <div className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-3">
            {me.role === "cityAdmin" ? t("lb.adminsNot") : t("lb.earnToJoin")}
          </div>
        )}
      </div>

      {leaders.length === 0 ? (
        <div className="card px-6 py-14 text-center text-sm text-ink-3">{t("lb.empty")}</div>
      ) : (
        <>
          <section aria-label={t("lb.top3")} className="card overflow-hidden px-3 pt-5 sm:px-4 sm:pt-6">
            <div className="mx-auto grid max-w-md grid-cols-3 items-end gap-2 sm:gap-6">
              {top.map((row, i) => (
                <Podium key={row.username} row={row} place={i as 0 | 1 | 2} me={me.username} i18n={i18n} />
              ))}
            </div>
          </section>

          {rest.length > 0 && (
            <ol className="card mt-4 divide-y divide-line overflow-hidden" start={4}>
              {rest.map((row, i) => {
                const badge = currentBadge(row.currentExp);
                const mine = row.username === me.username;
                return (
                  <li key={row.username} className={`flex items-center gap-3 px-3.5 py-3 sm:px-4 ${mine ? "bg-lime/30" : ""}`}>
                    <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums text-ink-3 sm:w-8">#{i + 4}</span>
                    <AvatarImg id={row.avatar} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {row.username}
                        {mine && <span className="ms-1.5 rounded-full bg-lime/55 px-1.5 py-0.5 text-[10px] font-semibold text-olive">{t("lb.youTag")}</span>}
                      </div>
                      <div className="text-xs text-ink-3">{badge.emoji} {i18n.badgeName(badge)}</div>
                    </div>
                    <div className="shrink-0 text-end font-semibold tabular-nums">
                      {row.currentExp} <span className="text-xs font-medium text-ink-3">{t("common.exp")}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      <p className="mt-5 text-center text-xs text-ink-3">
        {t("lb.footer")}{" "}
        <Link href="/profile" className="text-olive hover:underline">{t("lb.customise")}</Link>
      </p>
    </div>
  );
}
