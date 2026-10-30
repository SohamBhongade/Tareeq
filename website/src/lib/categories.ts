// Single source of truth for issue categories (ported from
// lib/core/issue_categories.dart in the Flutter app).
//
// The Gemini prompt, the JSON schema enum, the manual dropdown and the
// persistence layer all read from here, so they can never drift apart.

export const ISSUE_CATEGORIES = [
  "Exposed Wiring",
  "Broken Pipelines",
  "Potholes",
  "Traffic Signal Malfunction",
  "Broken Guardrails",
  "Broken Street Lights",
  "Water Accumulation",
  "Cracked Sidewalks",
  "Illegal Dumping",
  "Overflowing Bins",
  "Overgrown Vegetation",
  "Broken Signs",
  "Faded Road Markings",
  "Litter Accumulation",
  "Graffiti",
] as const;

export const OTHER_CATEGORY = "Other";

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number] | typeof OTHER_CATEGORY;

/** Canonical severity per category — the AI's guess is overridden by this. */
export const CANONICAL_SEVERITY: Record<string, number> = {
  "Exposed Wiring": 10,
  "Broken Pipelines": 10,
  Potholes: 8,
  "Traffic Signal Malfunction": 8,
  "Broken Guardrails": 7,
  "Broken Street Lights": 6,
  "Water Accumulation": 5,
  "Cracked Sidewalks": 5,
  "Illegal Dumping": 5,
  "Overflowing Bins": 4,
  Graffiti: 3,
  "Overgrown Vegetation": 2,
  "Litter Accumulation": 1,
  "Broken Signs": 3,
  "Faded Road Markings": 3,
};

/** Anything above this is reserved for municipal crews — for every role. */
export const VOLUNTEER_SEVERITY_CAP = 3;

export function normalizeSeverity(category: string, severity: number): number {
  const canonical = CANONICAL_SEVERITY[category];
  if (canonical !== undefined) return canonical;
  if (!Number.isFinite(severity)) return 1;
  return Math.min(10, Math.max(1, Math.round(severity)));
}

export type SeverityBand = "critical" | "moderate" | "minor";

export function severityBand(severity: number): SeverityBand {
  if (severity >= 7) return "critical";
  if (severity >= 4) return "moderate";
  return "minor";
}

export const BAND_LABEL: Record<SeverityBand, string> = {
  critical: "Critical",
  moderate: "Moderate",
  minor: "Minor",
};

export type Priority = "low" | "medium" | "high";

export function priorityFromSeverity(severity: number): Priority {
  if (severity >= 7) return "high";
  if (severity >= 4) return "medium";
  return "low";
}

export function isVolunteerEligible(severity: number): boolean {
  return severity <= VOLUNTEER_SEVERITY_CAP;
}
