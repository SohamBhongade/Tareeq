import type { Priority } from "./categories";

/** Mongo wire values — identical to the Android app so both share one DB. */
export type ReportStatus = "open" | "in_progress" | "pending_verification" | "resolved";

export const STATUS_LABEL: Record<ReportStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  pending_verification: "Pending Verification",
  resolved: "Resolved",
};

/** Resolved issues are deleted automatically this many days after they were fixed. */
export const RESOLVED_KEEP_DAYS = 28;

/** When a resolved issue will be removed (null if it isn't resolved or has no fix date). */
export function resolvedDeleteDate(r: { status: ReportStatus; fixedAt: string | null }): Date | null {
  if (r.status !== "resolved" || !r.fixedAt) return null;
  const t = new Date(r.fixedAt).getTime();
  return Number.isNaN(t) ? null : new Date(t + RESOLVED_KEEP_DAYS * 86_400_000);
}

/** Parses current and legacy status strings written by older app builds. */
export function parseStatus(s: unknown): ReportStatus {
  switch (s) {
    case "in_progress":
    case "inProgress":
      return "in_progress";
    case "pending_verification":
      return "pending_verification";
    case "resolved":
    case "fixed":
      return "resolved";
    default:
      return "open";
  }
}

/** A report as sent to the browser — images are fetched separately. */
export interface Report {
  id: string;
  category: string;
  severity: number;
  priority: Priority;
  description: string;
  /** Arabic version of the AI description (newer reports only). */
  descriptionAr: string | null;
  latitude: number;
  longitude: number;
  address: string;
  status: ReportStatus;
  createdAt: string;
  fixedAt: string | null;
  assignedVolunteerId: string | null;
  hasImage: boolean;
  hasProof: boolean;
  /** Who filed it (null for very old reports from the first app version). */
  reportedBy: string | null;
  /** Residents who confirmed "I see this too" via duplicate detection. */
  confirmedBy: string[];
}

/** An existing report that looks like the one being filed. */
export interface DuplicateMatch {
  report: Report;
  distanceM: number;
}

export type Role = "resident" | "cityAdmin";

export interface SessionUser {
  username: string;
  role: Role;
}

export interface AppUser extends SessionUser {
  currentExp: number;
  /** Avatar id from lib/avatars.ts (null = default). */
  avatar: string | null;
}

/** One row on the leaderboard. */
export interface LeaderRow {
  username: string;
  currentExp: number;
  avatar: string | null;
}

export interface AnalysisResult {
  category: string;
  severity: number;
  description: string;
  descriptionAr?: string | null;
  demo?: boolean;
  /** Which AI answered, e.g. "Gemini · gemini-3.5-flash-lite". */
  provider?: string;
}

export const EXP_REPORT_SUBMITTED = 50;
export const EXP_TASK_RESOLVED = 250;
/** For confirming an existing report instead of filing a duplicate. */
export const EXP_CONFIRMATION = 10;
export const DEFAULT_RESIDENT_EXP = 100;
export const DEFAULT_ADMIN_EXP = 5000;
