"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { SeverityChip, StatusChip } from "@/components/Chips";
import { Thumb } from "@/components/ReportRow";
import { useToast } from "@/components/Toast";
import { api } from "@/components/imageUtil";
import { useI18n } from "@/lib/i18n/client";
import type { DuplicateMatch, Report } from "@/lib/types";

/**
 * Shown on the report form when open reports of the same kind exist nearby.
 * Lets the resident confirm the existing one ("I see this too") instead of
 * filing a duplicate.
 */
export function DuplicatePanel({ matches, me, disabled }: { matches: DuplicateMatch[]; me: string; disabled?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { t, cat, timeAgo } = useI18n();

  async function confirm(id: string) {
    setBusyId(id);
    try {
      const { report } = await api<{ report: Report; exp: number | null }>(`/api/reports/${id}/confirm`, { method: "POST" });
      toast(t("dup.thanks"));
      router.push(`/issues/${report.id}`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "warn");
      setBusyId(null);
    }
  }

  return (
    <div role="region" aria-label={t("dup.region")} className="rounded-[18px] border border-moderate/40 bg-moderate/[0.07] p-4">
      <div className="flex items-start gap-2.5">
        <Icon name="users" size={20} className="mt-0.5 shrink-0 text-moderate" />
        <div>
          <div className="font-semibold text-ink">{t("dup.title")}</div>
          <p className="text-xs text-ink-2">
            {matches.length === 1 ? t("dup.one") : t("dup.many", { n: matches.length })}{" "}
            {t("dup.why")}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2.5">
        {matches.map(({ report: r, distanceM }) => {
          const mine = r.reportedBy === me;
          const already = r.confirmedBy.includes(me);
          return (
            <li key={r.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex gap-3">
                <Thumb report={r} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate font-medium">{cat(r.category)}</span>
                    <span className="shrink-0 text-xs font-semibold text-moderate tabular-nums">{t("dup.away", { n: distanceM })}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-3">{r.address}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <SeverityChip severity={r.severity} />
                    <StatusChip status={r.status} />
                    <span suppressHydrationWarning className="text-[11px] text-ink-3">
                      {timeAgo(r.createdAt)}
                      {r.confirmedBy.length > 0 && t("dup.confirmedBy", { n: r.confirmedBy.length })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {mine || already ? (
                  <span className="flex-1 rounded-lg bg-ink/[0.05] px-3 py-2 text-center text-xs text-ink-3">
                    {mine ? t("dup.yours") : t("dup.already")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => confirm(r.id)}
                    disabled={disabled || busyId !== null}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-fill px-3 py-2 text-sm font-semibold text-on-fill hover:bg-fill-hover disabled:opacity-50"
                  >
                    {busyId === r.id ? <span className="spin size-3.5 rounded-full border-2 border-white/30 border-t-white" /> : <Icon name="check" size={16} />}
                    {t("dup.confirm")}
                  </button>
                )}
                <Link href={`/issues/${r.id}`} className="rounded-lg border border-line px-3 py-2 text-sm text-ink-2 hover:bg-ink/[0.05]">
                  {t("common.view")}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
