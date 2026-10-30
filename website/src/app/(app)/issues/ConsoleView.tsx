"use client";
import { useMemo, useState } from "react";
import { useReports } from "@/components/useReports";
import { ReportRow } from "@/components/ReportRow";
import type { Report, ReportStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { severityBand } from "@/lib/categories";

type Filter = "all" | ReportStatus;
type Sort = "newest" | "severity" | "confirmed";

export function ConsoleView({ initial }: { initial: Report[] }) {
  const { reports } = useReports(initial);
  const { t, cat, status: statusName } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: reports.length, open: 0, in_progress: 0, pending_verification: 0, resolved: 0 };
    reports.forEach((r) => c[r.status]++);
    return c;
  }, [reports]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return reports
      .filter((r) => filter === "all" || r.status === filter)
      .filter((r) => !needle || r.category.toLowerCase().includes(needle) || cat(r.category).includes(needle) || r.address.toLowerCase().includes(needle))
      .sort((a, b) => {
        const newest = a.createdAt < b.createdAt ? 1 : -1;
        if (sort === "severity") return b.severity - a.severity || newest;
        if (sort === "confirmed") return b.confirmedBy.length - a.confirmedBy.length || b.severity - a.severity || newest;
        return newest;
      });
  }, [reports, filter, sort, q, cat]);

  const critical = reports.filter((r) => r.status !== "resolved" && severityBand(r.severity) === "critical").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">{t("console.title")}</h1>
          <p className="mt-1 text-[13.5px] text-ink-2 sm:text-sm">{t("console.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          [t("console.total"), counts.all, "text-ink"],
          [t("console.open"), counts.open + counts.in_progress + counts.pending_verification, "text-olive"],
          [t("console.criticalOpen"), critical, "text-critical"],
          [t("console.fixed"), counts.resolved, "text-minor"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="card !rounded-[16px] px-2.5 py-3 sm:!rounded-[22px] sm:px-4 sm:py-4">
            <div className="label line-clamp-2 min-h-[2.4em] !text-[11px] leading-[1.2] sm:min-h-0 sm:!text-[12px]">{l}</div>
            <div className={`mt-0.5 text-[22px] font-semibold tabular-nums sm:mt-1 sm:text-3xl ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2.5 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <div role="tablist" aria-label={t("console.filter")}
          className="chip-scroll -mx-4 flex scroll-px-4 gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {(["all", "open", "in_progress", "pending_verification", "resolved"] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium sm:h-auto sm:px-3 sm:py-1.5 sm:text-xs ${filter === f ? "border-fill bg-fill text-on-fill" : "border-line bg-surface text-ink-2 hover:bg-ink/[0.05]"}`}>
              {f === "all" ? t("console.all") : statusName(f)} <span className="ms-1 tabular-nums opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:ms-auto">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("console.search")} aria-label={t("console.search")}
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm outline-none placeholder:text-ink-4 focus:border-ink/40 sm:w-60 sm:flex-none" />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t("console.sort")}
            className="h-10 w-auto max-w-[48%] shrink-0 rounded-xl border border-line bg-surface px-2.5 text-sm outline-none focus:border-ink/40 sm:max-w-none">
            <option value="newest">{t("console.newest")}</option>
            <option value="severity">{t("console.severe")}</option>
            <option value="confirmed">{t("console.confirmed")}</option>
          </select>
        </div>
      </div>

      <div className="card mt-3 divide-y divide-line overflow-hidden !rounded-[18px] sm:mt-4 sm:!rounded-[22px]">
        {shown.map((r) => <ReportRow key={r.id} report={r} />)}
        {shown.length === 0 && <p className="px-4 py-12 text-center text-sm text-ink-3">{t("console.empty")}</p>}
      </div>
    </div>
  );
}
