"use client";
import Link from "next/link";
import type { Report } from "@/lib/types";
import { ConfirmChip, SeverityChip, StatusChip } from "./Chips";
import { Icon } from "./Icon";
import { useI18n } from "@/lib/i18n/client";

export function Thumb({ report, size = 56, className = "" }: { report: Report; size?: number; className?: string }) {
  return report.hasImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/reports/${report.id}/image?w=${size * 2}`} alt="" width={size} height={size} loading="lazy" decoding="async"
      className={`shrink-0 rounded-xl border border-line object-cover ${className}`} style={{ width: size, height: size }} />
  ) : (
    <span className={`grid shrink-0 place-items-center rounded-xl border border-line bg-surface-high text-ink-3 ${className}`} style={{ width: size, height: size }}>
      <Icon name="image" size={size / 2.4} />
    </span>
  );
}

export function ReportRow({ report, compact = false }: { report: Report; compact?: boolean }) {
  const { cat, timeAgo } = useI18n();
  return (
    <Link href={`/issues/${report.id}`} className="flex gap-3 px-3.5 py-3.5 transition-colors hover:bg-ink/[0.04] sm:gap-3.5 sm:px-4">
      <Thumb report={report} size={compact ? 48 : 64} className={compact ? "" : "max-sm:!size-14"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate font-medium">{cat(report.category)}</div>
          <span suppressHydrationWarning className="shrink-0 text-[11px] text-ink-3">{timeAgo(report.createdAt)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-3">
          <Icon name="pin" size={12} className="shrink-0" />
          <span className="truncate" dir="auto">{report.address}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <SeverityChip severity={report.severity} />
          <StatusChip status={report.status} />
          <ConfirmChip count={report.confirmedBy.length} />
        </div>
      </div>
    </Link>
  );
}
