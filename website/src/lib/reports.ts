import "server-only";
import { cache } from "react";
import {
  ISSUE_CATEGORIES,
  OTHER_CATEGORY,
  VOLUNTEER_SEVERITY_CAP,
  normalizeSeverity,
  priorityFromSeverity,
} from "./categories";
import { getStore, toReport } from "./store";
import { boundingBox, distanceMeters } from "./geo";
import { AVATARS, isUnlocked } from "./avatars";
import {
  DEFAULT_ADMIN_EXP,
  DEFAULT_RESIDENT_EXP,
  EXP_REPORT_SUBMITTED,
  EXP_TASK_RESOLVED,
  EXP_CONFIRMATION,
  parseStatus,
  resolvedDeleteDate,
  RESOLVED_KEEP_DAYS,
  type DuplicateMatch,
  type LeaderRow,
  type AppUser,
  type Report,
  type SessionUser,
} from "./types";

/** Same category within this distance counts as "probably the same issue". */
export const DUPLICATE_RADIUS_M = 60;
/** If either report is "Other", only treat it as a duplicate when very close. */
const DUPLICATE_RADIUS_OTHER_M = 25;

/** A rule violation — shown to the user as an informative message. */
export class RuleError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
    this.name = "RuleError";
  }
}

const loadUserCached = cache(async (username: string, role: SessionUser["role"]): Promise<AppUser> => {
  const u = await getStore().getOrSeedUser(username, role === "cityAdmin" ? DEFAULT_ADMIN_EXP : DEFAULT_RESIDENT_EXP, role);
  return { username, role, currentExp: u.currentExp, avatar: u.avatar };
});

export async function loadUser(session: SessionUser): Promise<AppUser> {
  return loadUserCached(session.username, session.role);
}

/** Changes the user's avatar — only to one they've unlocked with EXP. */
export async function chooseAvatar(session: SessionUser, avatarId: string): Promise<AppUser> {
  const avatar = AVATARS.find((a) => a.id === avatarId);
  if (!avatar) throw new RuleError("That avatar doesn't exist.", 400);
  const user = await loadUser(session);
  if (!isUnlocked(avatar, user.currentExp)) {
    throw new RuleError(`${avatar.name} unlocks at ${avatar.unlockExp} EXP. You have ${user.currentExp}.`, 403);
  }
  await getStore().setAvatar(session.username, avatar.id);
  return { ...user, avatar: avatar.id };
}

export async function getLeaderboard(limit = 50): Promise<LeaderRow[]> {
  return getStore().leaderboard(limit);
}

// ── auto-delete of old resolved issues ──
// Resolved issues are removed RESOLVED_KEEP_DAYS after they were fixed.
// The clean-up runs at most every 10 minutes, whenever reports are loaded;
// anything past its date is hidden right away even between clean-ups.
const SWEEP_EVERY_MS = 10 * 60_000;
const sweep = globalThis as unknown as { __tareeqSweepAt?: number; __tareeqSweep?: Promise<void> | null };

function resolvedCutoff() {
  return new Date(Date.now() - RESOLVED_KEEP_DAYS * 86_400_000);
}

function sweepResolved(): Promise<void> {
  if (sweep.__tareeqSweep) return sweep.__tareeqSweep;
  if (Date.now() - (sweep.__tareeqSweepAt ?? 0) < SWEEP_EVERY_MS) return Promise.resolve();
  sweep.__tareeqSweepAt = Date.now();
  sweep.__tareeqSweep = getStore()
    .deleteResolvedBefore(resolvedCutoff())
    .then((n) => { if (n) console.log(`[cleanup] deleted ${n} resolved issue(s) older than ${RESOLVED_KEEP_DAYS} days`); })
    .catch((e) => { sweep.__tareeqSweepAt = 0; console.warn("[cleanup] could not delete old resolved issues:", (e as Error)?.message); })
    .finally(() => { sweep.__tareeqSweep = null; });
  return sweep.__tareeqSweep;
}

const expired = (r: Report) => {
  const at = resolvedDeleteDate(r);
  return !!at && at.getTime() <= Date.now();
};

// cache(): if the layout and the page both ask during one page load,
// the database is only queried once.
export const listReports = cache(async (): Promise<Report[]> => {
  await sweepResolved();
  return (await getStore().listReports()).filter((r) => !expired(r));
});

export const getReport = cache(async (id: string): Promise<Report | null> => {
  await sweepResolved();
  const r = await getStore().getReport(id);
  return r && !expired(r) ? r : null;
});

export interface CreateReportInput {
  category: string;
  severity: number;
  description: string;
  descriptionAr?: string | null;
  latitude: number;
  longitude: number;
  address: string;
  imageBase64: string;
}

/**
 * Open reports that look like the same problem: same category, close by.
 * Nearest first. Resolved reports are never matched — if it's broken
 * again after a fix, that's a new report.
 */
export async function findDuplicates(lat: number, lng: number, category: string): Promise<DuplicateMatch[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const candidates = await getStore().listOpenInBox(boundingBox(lat, lng, DUPLICATE_RADIUS_M));
  return candidates
    .map((report) => ({ report, distanceM: Math.round(distanceMeters(lat, lng, report.latitude, report.longitude)) }))
    .filter(({ report, distanceM }) => {
      const otherInvolved = report.category === OTHER_CATEGORY || category === OTHER_CATEGORY;
      if (otherInvolved) return distanceM <= DUPLICATE_RADIUS_OTHER_M;
      return report.category === category && distanceM <= DUPLICATE_RADIUS_M;
    })
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 3);
}

/** A resident says "I see this too" on an existing report. */
export async function confirmReport(user: SessionUser, id: string): Promise<{ report: Report; exp: number | null }> {
  const doc = await getStore().getReportDoc(id);
  if (!doc) throw new RuleError("Report not found.", 404);
  if (parseStatus(doc.status) === "resolved") throw new RuleError("This issue has already been fixed.");
  if (doc.reportedBy === user.username) throw new RuleError("You reported this issue yourself.");
  if ((doc.confirmations ?? []).includes(user.username)) throw new RuleError("You've already confirmed this issue.");
  const report = await getStore().addConfirmation(id, user.username);
  if (!report) throw new RuleError("You've already confirmed this issue.");
  const exp = await getStore().awardExp(user.username, EXP_CONFIRMATION);
  return { report, exp };
}

/** Thrown when a new report matches existing ones and the user hasn't chosen "submit anyway". */
export class DuplicateError extends Error {
  constructor(public matches: DuplicateMatch[]) {
    super("This issue looks like it has already been reported nearby.");
    this.name = "DuplicateError";
  }
}

export async function createReport(user: SessionUser, input: CreateReportInput & { forceNew?: boolean }) {
  const allowed = new Set<string>([...ISSUE_CATEGORIES, OTHER_CATEGORY]);
  const category = allowed.has(input.category) ? input.category : OTHER_CATEGORY;
  // The chokepoint: canonical severity always wins over the AI's guess.
  const severity = normalizeSeverity(category, Number(input.severity));
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new RuleError("A location is required to file a report.", 400);
  }
  // Server-side duplicate check, so it also applies to anything that
  // skips the website's own check (old app builds, direct API calls).
  if (!input.forceNew) {
    const matches = await findDuplicates(input.latitude, input.longitude, category);
    if (matches.length) throw new DuplicateError(matches);
  }
  const report = await getStore().createReport({
    category,
    severity,
    priority: priorityFromSeverity(severity),
    description: String(input.description ?? "").slice(0, 600),
    descriptionAr: input.descriptionAr ? String(input.descriptionAr).slice(0, 600) : null,
    latitude: input.latitude,
    longitude: input.longitude,
    address: String(input.address ?? "").slice(0, 300),
    imageBase64: input.imageBase64 || null,
    status: "open",
    createdAt: new Date().toISOString(),
    fixedAt: null,
    assignedVolunteerId: null,
    proofOfWorkImageUrl: null,
    confirmations: [],
    reportedBy: user.username,
  });
  const exp = await getStore().awardExp(user.username, EXP_REPORT_SUBMITTED);
  return { report, exp };
}

/** Rule A — anyone may volunteer, but only for severity ≤ 3 tasks. */
export async function volunteer(user: SessionUser, id: string): Promise<Report> {
  const doc = await getStore().getReportDoc(id);
  if (!doc) throw new RuleError("Report not found.", 404);
  if (Number(doc.severity) > VOLUNTEER_SEVERITY_CAP) {
    throw new RuleError("This is a high-severity critical issue. Please leave it to the municipal team.");
  }
  if (parseStatus(doc.status) !== "open" || doc.assignedVolunteerId) {
    throw new RuleError("Someone has already volunteered for this task.");
  }
  const updated = await getStore().updateReportIf(
    id,
    { status: "open", assignedVolunteerId: null },
    { status: "in_progress", assignedVolunteerId: user.username },
  );
  if (!updated) throw new RuleError("Someone has already volunteered for this task.");
  return updated;
}

/** Rule B, part 1 — only the assigned volunteer can submit proof. */
export async function submitProof(user: SessionUser, id: string, proofBase64: string): Promise<Report> {
  const doc = await getStore().getReportDoc(id);
  if (!doc) throw new RuleError("Report not found.", 404);
  if (parseStatus(doc.status) !== "in_progress") {
    throw new RuleError("Proof can only be submitted for a task that is in progress.");
  }
  if (doc.assignedVolunteerId !== user.username) {
    throw new RuleError("Only the assigned volunteer can submit proof for this task.", 403);
  }
  if (!proofBase64) throw new RuleError("Please attach a photo of the completed work.", 400);
  const updated = await getStore().updateReportIf(
    id,
    { status: "in_progress", assignedVolunteerId: user.username },
    { status: "pending_verification", proofOfWorkImageUrl: proofBase64 },
  );
  if (!updated) throw new RuleError("This task changed while you were uploading. Refresh and try again.");
  return updated;
}

/** Rule B, part 2 — only a City Admin can verify and resolve. */
export async function verifyAndResolve(user: SessionUser, id: string): Promise<{ report: Report; volunteer: string | null }> {
  if (user.role !== "cityAdmin") throw new RuleError("Only a City Admin can verify completed work.", 403);
  const doc = await getStore().getReportDoc(id);
  if (!doc) throw new RuleError("Report not found.", 404);
  if (parseStatus(doc.status) !== "pending_verification") {
    throw new RuleError("This task is not waiting for verification.");
  }
  if (!doc.proofOfWorkImageUrl) throw new RuleError("There is no proof photo to verify yet.");
  const updated = await getStore().updateReportIf(
    id,
    { status: "pending_verification" },
    { status: "resolved", fixedAt: new Date().toISOString() },
  );
  if (!updated) throw new RuleError("This task changed while you were reviewing it. Refresh and try again.");
  const volunteerName = doc.assignedVolunteerId ? String(doc.assignedVolunteerId) : null;
  if (volunteerName) await getStore().awardExp(volunteerName, EXP_TASK_RESOLVED);
  return { report: updated, volunteer: volunteerName };
}

export type AdminAction = "dispatch" | "resolve" | "reject";

/**
 * City Admin controls for any issue:
 *  • dispatch — send a city crew (open → in progress)
 *  • resolve  — mark fixed directly (open / in progress → resolved)
 *  • reject   — send a volunteer's proof back (pending → in progress)
 * Approving a volunteer's proof (+250 EXP) stays in verifyAndResolve.
 */
export async function adminAction(user: SessionUser, id: string, action: AdminAction): Promise<Report> {
  if (user.role !== "cityAdmin") throw new RuleError("Only a City Admin can do this.", 403);
  const doc = await getStore().getReportDoc(id);
  if (!doc) throw new RuleError("Report not found.", 404);
  const status = parseStatus(doc.status);
  const changed = "This issue changed while you were looking at it. Refresh and try again.";

  if (action === "dispatch") {
    if (status !== "open") throw new RuleError("Only open issues can be sent to a crew.");
    const r = await getStore().updateReportIf(id, { status: "open" }, { status: "in_progress", assignedVolunteerId: null });
    if (!r) throw new RuleError(changed);
    return r;
  }
  if (action === "resolve") {
    if (status === "resolved") throw new RuleError("This issue is already resolved.");
    if (status === "pending_verification") throw new RuleError("A volunteer sent proof — use Verify & resolve instead.");
    const r = await getStore().updateReportIf(id, { status }, { status: "resolved", fixedAt: new Date().toISOString() });
    if (!r) throw new RuleError(changed);
    return r;
  }
  if (action === "reject") {
    if (status !== "pending_verification") throw new RuleError("There is no proof waiting to be reviewed.");
    const r = await getStore().updateReportIf(id, { status: "pending_verification" }, { status: "in_progress", proofOfWorkImageUrl: null });
    if (!r) throw new RuleError(changed);
    return r;
  }
  throw new RuleError("Unknown action.", 400);
}
