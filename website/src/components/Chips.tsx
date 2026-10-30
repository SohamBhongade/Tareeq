"use client";
import { severityBand } from "@/lib/categories";
import type { ReportStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { SEVERITY_COLORS } from "./mapTypes";

const BAND_CLASS = {
  critical: "text-critical bg-critical/10",
  moderate: "text-moderate bg-moderate/12",
  minor: "text-minor bg-minor/12",
} as const;

export function SeverityChip({ severity, className = "" }: { severity: number; className?: string }) {
  const band = severityBand(severity);
  const { band: bandName } = useI18n();
  return (
    <span className={`tag ${BAND_CLASS[band]} ${className}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {bandName(band)} · <span dir="ltr">{severity}/10</span>
    </span>
  );
}

const STATUS_CLASS: Record<ReportStatus, string> = {
  open: "bg-surface-overlay text-ink-2",
  in_progress: "bg-lime text-on-lime",
  pending_verification: "bg-lilac text-pending",
  resolved: "border border-line bg-surface text-ink-3",
};

/** Status tag. `dark` is the black-with-lime variant used on the map's detail bar. */
export function StatusChip({ status, dark = false, className = "" }: { status: ReportStatus; dark?: boolean; className?: string }) {
  const { status: statusName } = useI18n();
  return (
    <span className={`tag ${dark ? "bg-fill text-fill-accent" : STATUS_CLASS[status]} ${className}`}>
      {statusName(status)}
    </span>
  );
}

/** "Confirmed by N residents" badge from duplicate detection. */
export function ConfirmChip({ count, className = "" }: { count: number; className?: string }) {
  const { t } = useI18n();
  if (count <= 0) return null;
  return (
    <span title={t("chip.confirmedBy", { n: count })} className={`tag bg-fill text-fill-accent ${className}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.4a6 6 0 0 1 3 5.6" />
      </svg>
      +{count}
    </span>
  );
}

export function severityColor(severity: number): string {
  return SEVERITY_COLORS[severityBand(severity)];
}

/** How far along the fix is, for the progress bar on report cards. */
export const STATUS_PROGRESS: Record<ReportStatus, number> = {
  open: 12,
  in_progress: 50,
  pending_verification: 80,
  resolved: 100,
};
