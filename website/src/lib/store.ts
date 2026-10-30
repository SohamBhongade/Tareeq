import "server-only";
import { MongoClient, ObjectId, type Collection } from "mongodb";
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { priorityFromSeverity, type Priority } from "./categories";
import { parseStatus, type LeaderRow, type Report, type ReportStatus, type Role } from "./types";

/**
 * Report document as stored in MongoDB. Field names and value formats match
 * the Flutter app exactly, so the website and the Android app can share one
 * database.
 */
export interface ReportDoc {
  _id?: ObjectId | string;
  category: string;
  severity: number;
  priority: Priority;
  description: string;
  /** Arabic description from the AI (website only; the Android app ignores it). */
  descriptionAr?: string | null;
  latitude: number;
  longitude: number;
  address: string;
  imageBase64: string | null;
  status: ReportStatus | string;
  createdAt: string;
  fixedAt: string | null;
  assignedVolunteerId: string | null;
  proofOfWorkImageUrl: string | null;
  /** Usernames who confirmed this issue via duplicate detection. */
  confirmations?: string[];
  reportedBy?: string | null;
}

export type NewReport = Omit<ReportDoc, "_id">;

/** A signed-up account (stored in the same "users" collection as EXP). */
export interface Account {
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export type OtpPurpose = "signup" | "reset";

/** A pending email code. For sign-ups it also holds the details to create the account with. */
export interface OtpDoc {
  emailLower: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
  sentAt: Date;
  attempts: number;
  pending?: { username: string; email: string; passwordHash: string };
}
export type ReportPatch = Partial<
  Pick<ReportDoc, "status" | "fixedAt" | "assignedVolunteerId" | "proofOfWorkImageUrl">
>;

export interface Store {
  readonly mode: "mongo" | "memory";
  listReports(): Promise<Report[]>;
  getReportDoc(id: string): Promise<ReportDoc | null>;
  /** One report without its photos (fast). */
  getReport(id: string): Promise<Report | null>;
  /** Just one stored photo ("photo" = the report, "proof" = volunteer's proof). */
  getImage(id: string, kind: "photo" | "proof"): Promise<string | null>;
  createReport(doc: NewReport): Promise<Report>;
  /**
   * Atomically applies [patch] only if the stored report still matches
   * [expect]. Returns the updated report, or null when the precondition
   * failed (someone else changed it first) or the id doesn't exist.
   */
  updateReportIf(
    id: string,
    expect: Partial<Pick<ReportDoc, "status" | "assignedVolunteerId">>,
    patch: ReportPatch,
  ): Promise<Report | null>;
  /** Unresolved reports inside a lat/lng box (callers refine by true distance). */
  listOpenInBox(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<Report[]>;
  /**
   * Adds [username] to a report's confirmations, once. Refuses resolved
   * reports and the original reporter. Returns null if nothing changed.
   */
  addConfirmation(id: string, username: string): Promise<Report | null>;
  /** Connects to the database ahead of the first request (no-op in demo mode). */
  warmUp(): Promise<void>;
  /** Permanently deletes resolved reports fixed before [cutoff]. Returns how many were removed. */
  deleteResolvedBefore(cutoff: Date): Promise<number>;
  getOrSeedExp(username: string, defaultExp: number): Promise<number>;
  /** EXP + avatar for a user, creating the user document on first login. */
  getOrSeedUser(username: string, defaultExp: number, role: Role): Promise<{ currentExp: number; avatar: string | null }>;
  /** Saves the chosen avatar id. */
  setAvatar(username: string, avatar: string): Promise<void>;
  /** Residents ranked by EXP (City Admins excluded). */
  leaderboard(limit: number): Promise<LeaderRow[]>;
  awardExp(username: string, delta: number): Promise<number>;

  // ── accounts ──
  /** By username (any capitalisation) or email. */
  findAccount(usernameOrEmail: string): Promise<Account | null>;
  usernameTaken(username: string): Promise<boolean>;
  emailTaken(email: string): Promise<boolean>;
  /** Creates a resident account with starting EXP. Returns false if the name or email was taken meanwhile. */
  createAccount(a: Account, startExp: number): Promise<boolean>;
  setPasswordHash(email: string, passwordHash: string): Promise<boolean>;
  saveOtp(o: OtpDoc): Promise<void>;
  getOtp(email: string, purpose: OtpPurpose): Promise<OtpDoc | null>;
  bumpOtpAttempts(email: string, purpose: OtpPurpose): Promise<void>;
  deleteOtp(email: string, purpose: OtpPurpose): Promise<void>;
}

const escapeRegex = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Thrown when MongoDB can't be reached; shown to users as a friendly message. */
export class DatabaseUnavailableError extends Error {
  constructor(public cause: unknown) {
    const detail = (cause as Error)?.message ?? String(cause);
    super(`Database unavailable: ${detail}`);
    this.name = "DatabaseUnavailableError";
  }
}

// ── shared helpers ─────────────────────────────────────────────────────

export function toReport(doc: ReportDoc): Report {
  const severity = Number(doc.severity) || 1;
  return {
    id: String(doc._id),
    category: String(doc.category ?? "Unknown"),
    severity,
    priority: (doc.priority as Priority) ?? priorityFromSeverity(severity),
    description: String(doc.description ?? ""),
    descriptionAr: typeof doc.descriptionAr === "string" && doc.descriptionAr ? doc.descriptionAr : null,
    latitude: Number(doc.latitude) || 0,
    longitude: Number(doc.longitude) || 0,
    address: String(doc.address ?? ""),
    status: parseStatus(doc.status),
    createdAt: toIso(doc.createdAt),
    fixedAt: doc.fixedAt ? toIso(doc.fixedAt) : null,
    assignedVolunteerId: doc.assignedVolunteerId ? String(doc.assignedVolunteerId) : null,
    hasImage: !!doc.imageBase64,
    hasProof: !!doc.proofOfWorkImageUrl,
    reportedBy: doc.reportedBy ? String(doc.reportedBy) : null,
    confirmedBy: Array.isArray(doc.confirmations) ? doc.confirmations.map(String) : [],
  };
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Decodes the app's image formats (raw base64 or data URI) into bytes. */
export function decodeImage(value: string | null | undefined): { mime: string; bytes: Buffer } | null {
  if (!value) return null;
  let mime = "";
  let data = value;
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
  if (m) {
    mime = m[1] ?? "";
    data = m[3];
  }
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length) return null;
  if (!mime) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) mime = "image/png";
    else if (bytes.subarray(0, 4).toString() === "RIFF") mime = "image/webp";
    else mime = "image/jpeg";
  }
  return { mime, bytes };
}

// ── MongoDB implementation ─────────────────────────────────────────────

let publicDnsApplied = false;
const systemDns = dns.getServers();
const PUBLIC_DNS = ["8.8.8.8", "1.1.1.1"];
// Remembers (between restarts) that this network needs public DNS for the
// MongoDB address, so later starts skip the slow failed attempt.
const DNS_NOTE = path.join(process.cwd(), ".next", "cache", "tareeq-public-dns");

function usePublicDns(on: boolean) {
  dns.setServers(on ? [...PUBLIC_DNS, ...systemDns] : systemDns);
  publicDnsApplied = on;
  try {
    if (on) {
      mkdirSync(path.dirname(DNS_NOTE), { recursive: true });
      writeFileSync(DNS_NOTE, "1");
    } else if (existsSync(DNS_NOTE)) unlinkSync(DNS_NOTE);
  } catch {
    /* read-only disk (e.g. Cloud Run): just don't remember */
  }
}

class MongoStore implements Store {
  readonly mode = "mongo" as const;
  private clientPromise: Promise<MongoClient> | null = null;

  constructor(private uri: string, private dbName: string) {}

  /**
   * Connects lazily and retries on the next request if it fails, instead of
   * caching a dead connection forever.
   *
   * `mongodb+srv://` addresses need a DNS "SRV" lookup. Some home routers and
   * ISP DNS servers don't answer those (Node reports `querySrv ENOTFOUND` or
   * `ECONNREFUSED`), even though the cluster exists. When that happens we
   * retry once using Google and Cloudflare public DNS for these lookups.
   */
  private client(): Promise<MongoClient> {
    if (!/^mongodb(\+srv)?:\/\//.test(this.uri)) {
      const shown = this.uri.slice(0, 14).replace(/:[^@]*@/, ":***@");
      return Promise.reject(
        new DatabaseUnavailableError(
          new Error(
            `MONGODB_URI in .env.local must start with "mongodb+srv://" — it currently starts with "${shown}…". ` +
              "Remove any quotes, spaces or extra text before it.",
          ),
        ),
      );
    }
    if (!this.clientPromise) {
      if (!publicDnsApplied && this.uri.startsWith("mongodb+srv://") && existsSync(DNS_NOTE)) {
        dns.setServers([...PUBLIC_DNS, ...systemDns]);
        publicDnsApplied = true;
      }
      const open = () =>
        new MongoClient(this.uri, { appName: "FixMyStreetWeb", serverSelectionTimeoutMS: 15000 }).connect();
      this.clientPromise = open()
        .then((c) => {
          this.ensureIndexes(c);
          return c;
        })
        .catch(async (e: unknown) => {
          const code = (e as { code?: string })?.code;
          const srvFailure =
            this.uri.startsWith("mongodb+srv://") &&
            /querySrv|queryTxt/.test(String((e as Error)?.message)) &&
            (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "ETIMEOUT" || code === "ESERVFAIL");
          if (!srvFailure) throw e;
          if (publicDnsApplied) {
            // We used public DNS from last time but it failed here: go back to the system DNS.
            console.warn("[mongo] SRV lookup failed with public DNS; retrying with system DNS");
            usePublicDns(false);
          } else {
            console.warn("[mongo] SRV lookup failed with system DNS; retrying with public DNS (8.8.8.8, 1.1.1.1)");
            usePublicDns(true);
          }
          return open();
        })
        .catch((e: unknown) => {
          this.clientPromise = null; // let the next request try again
          throw new DatabaseUnavailableError(e);
        });
    }
    return this.clientPromise;
  }

  /** Opens the connection early (called once when the server starts). */
  async warmUp() {
    const c = await this.client();
    await c.db(this.dbName).command({ ping: 1 });
  }

  /** Indexes that keep the common queries fast. Safe to run repeatedly; failures are ignored. */
  private ensureIndexes(c: MongoClient) {
    const db = c.db(this.dbName);
    Promise.all([
      db.collection("reports").createIndex({ createdAt: -1 }),
      db.collection("reports").createIndex({ latitude: 1, longitude: 1 }),
      db.collection("users").createIndex({ username: 1 }),
      db.collection("users").createIndex({ currentExp: -1 }),
    ]).catch((e) => console.warn("[mongo] could not create indexes:", (e as Error)?.message));
  }

  private async reports(): Promise<Collection<ReportDoc>> {
    const c = await this.client();
    return c.db(this.dbName).collection<ReportDoc>("reports");
  }

  private async users() {
    const c = await this.client();
    return c
      .db(this.dbName)
      .collection<{ username: string; currentExp: number; createdAt: string; avatar?: string | null; role?: Role }>("users");
  }

  private filterFor(id: string) {
    return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
  }

  /** Pipeline stage that swaps image payloads for "1"/null presence flags. */
  private static readonly imageFlags = {
    $addFields: {
      imageBase64: { $cond: [{ $gt: [{ $strLenBytes: { $ifNull: ["$imageBase64", ""] } }, 0] }, "1", null] },
      proofOfWorkImageUrl: {
        $cond: [{ $gt: [{ $strLenBytes: { $ifNull: ["$proofOfWorkImageUrl", ""] } }, 0] }, "1", null],
      },
    },
  };

  async listReports() {
    const col = await this.reports();
    const docs = await col
      .aggregate<ReportDoc>([MongoStore.imageFlags, { $sort: { createdAt: -1 } }])
      .toArray();
    return docs.map(toReport);
  }

  private async summary(id: string): Promise<Report | null> {
    const col = await this.reports();
    const [doc] = await col
      .aggregate<ReportDoc>([{ $match: this.filterFor(id) }, MongoStore.imageFlags])
      .toArray();
    return doc ? toReport(doc) : null;
  }

  async getReportDoc(id: string) {
    const col = await this.reports();
    return (await col.findOne(this.filterFor(id) as never)) ?? null;
  }

  async getReport(id: string) {
    return this.summary(id);
  }

  async getImage(id: string, kind: "photo" | "proof") {
    const col = await this.reports();
    const field = kind === "proof" ? "proofOfWorkImageUrl" : "imageBase64";
    const doc = await col.findOne(this.filterFor(id) as never, { projection: { [field]: 1 } });
    const v = (doc as Record<string, unknown> | null)?.[field];
    return typeof v === "string" && v ? v : null;
  }

  async createReport(doc: NewReport) {
    const col = await this.reports();
    const res = await col.insertOne({ ...doc } as ReportDoc);
    return toReport({ ...doc, _id: res.insertedId });
  }

  async updateReportIf(id: string, expect: Partial<ReportDoc>, patch: ReportPatch) {
    const col = await this.reports();
    const filter: Record<string, unknown> = { ...this.filterFor(id) };
    if (expect.status !== undefined) {
      // Accept the legacy spellings the old app may have written.
      const legacy: Record<string, string[]> = {
        open: ["open", "pending", null as unknown as string], // null also matches a missing status
        in_progress: ["in_progress", "inProgress"],
        pending_verification: ["pending_verification"],
        resolved: ["resolved", "fixed"],
      };
      filter.status = { $in: legacy[String(expect.status)] ?? [expect.status] };
    }
    if (expect.assignedVolunteerId !== undefined) {
      filter.assignedVolunteerId = expect.assignedVolunteerId;
    }
    const updated = await col.findOneAndUpdate(filter as never, { $set: patch }, {
      projection: { _id: 1 },
    });
    if (!updated) return null;
    return this.summary(id);
  }

  async deleteResolvedBefore(cutoff: Date) {
    const col = await this.reports();
    // fixedAt may be an ISO string (website), a Date or a number (older app builds) — compare as dates.
    const fixed = { $convert: { input: "$fixedAt", to: "date", onError: null, onNull: null } };
    const res = await col.deleteMany({
      status: { $in: ["resolved", "fixed"] },
      fixedAt: { $ne: null },
      $expr: { $and: [{ $ne: [fixed, null] }, { $lt: [fixed, cutoff] }] },
    } as never);
    return res.deletedCount ?? 0;
  }

  async listOpenInBox(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }) {
    const col = await this.reports();
    const docs = await col
      .aggregate<ReportDoc>([
        {
          $match: {
            latitude: { $gte: box.minLat, $lte: box.maxLat },
            longitude: { $gte: box.minLng, $lte: box.maxLng },
            status: { $nin: ["resolved", "fixed"] },
          },
        },
        MongoStore.imageFlags,
      ])
      .toArray();
    return docs.map(toReport);
  }

  async addConfirmation(id: string, username: string) {
    const col = await this.reports();
    const updated = await col.findOneAndUpdate(
      {
        ...this.filterFor(id),
        status: { $nin: ["resolved", "fixed"] },
        reportedBy: { $ne: username },
        confirmations: { $ne: username },
      } as never,
      { $addToSet: { confirmations: username } } as never,
      { projection: { _id: 1 } },
    );
    if (!updated) return null;
    return this.summary(id);
  }

  async getOrSeedExp(username: string, defaultExp: number) {
    const col = await this.users();
    const doc = await col.findOneAndUpdate(
      { username },
      { $setOnInsert: { currentExp: defaultExp, createdAt: new Date().toISOString() } },
      { upsert: true, returnDocument: "after" },
    );
    const exp = doc?.currentExp;
    return typeof exp === "number" ? exp : defaultExp;
  }

  async getOrSeedUser(username: string, defaultExp: number, role: Role) {
    const col = await this.users();
    // Fast path: a plain read (most page loads). Writing on every page view was slow.
    const found = await col.findOne({ username }, { projection: { currentExp: 1, avatar: 1, role: 1 } });
    if (found && found.role === role && typeof found.currentExp === "number") {
      return { currentExp: found.currentExp, avatar: typeof found.avatar === "string" ? found.avatar : null };
    }
    const doc = await col.findOneAndUpdate(
      { username },
      // `role` is (re)written on every login so the leaderboard can leave admins out.
      { $setOnInsert: { currentExp: defaultExp, createdAt: new Date().toISOString() }, $set: { role } },
      { upsert: true, returnDocument: "after" },
    );
    return {
      currentExp: typeof doc?.currentExp === "number" ? doc.currentExp : defaultExp,
      avatar: typeof doc?.avatar === "string" ? doc.avatar : null,
    };
  }

  async setAvatar(username: string, avatar: string) {
    const col = await this.users();
    await col.updateOne({ username }, { $set: { avatar } }, { upsert: true });
  }

  async leaderboard(limit: number) {
    const col = await this.users();
    const docs = await col
      .find({ role: { $ne: "cityAdmin" }, username: { $ne: "CityAdmin" } })
      .sort({ currentExp: -1, username: 1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => ({
      username: String(d.username),
      currentExp: Number(d.currentExp) || 0,
      avatar: typeof d.avatar === "string" ? d.avatar : null,
    }));
  }

  async awardExp(username: string, delta: number) {
    const col = await this.users();
    const doc = await col.findOneAndUpdate(
      { username },
      { $inc: { currentExp: delta }, $setOnInsert: { createdAt: new Date().toISOString() } },
      { upsert: true, returnDocument: "after" },
    );
    return Number(doc?.currentExp ?? delta);
  }

  // ── accounts ─────────────────────────────────────────────────────────
  private accountIndexes: Promise<unknown> | null = null;

  private async accountCols() {
    const c = await this.client();
    const db = c.db(this.dbName);
    const users = db.collection<Record<string, unknown>>("users");
    const otps = db.collection<OtpDoc>("otps");
    this.accountIndexes ??= Promise.all([
      users.createIndex({ usernameLower: 1 }, { unique: true, sparse: true }),
      users.createIndex({ emailLower: 1 }, { unique: true, sparse: true }),
      otps.createIndex({ emailLower: 1, purpose: 1 }, { unique: true }),
      otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }), // Mongo deletes expired codes itself
    ]).catch((e) => console.warn("[mongo] account indexes:", (e as Error)?.message));
    await this.accountIndexes;
    return { users, otps };
  }

  async findAccount(usernameOrEmail: string) {
    const { users } = await this.accountCols();
    const key = usernameOrEmail.trim().toLowerCase();
    const doc = await users.findOne(
      { $or: [{ usernameLower: key }, { emailLower: key }], passwordHash: { $exists: true } },
      { projection: { username: 1, email: 1, passwordHash: 1, role: 1 } },
    );
    if (!doc) return null;
    return {
      username: String(doc.username),
      email: String(doc.email),
      passwordHash: String(doc.passwordHash),
      role: (doc.role as Role) ?? "resident",
    };
  }

  async usernameTaken(username: string) {
    const { users } = await this.accountCols();
    const name = username.trim();
    // Also catches older users (e.g. from the Android app) saved without usernameLower.
    const doc = await users.findOne(
      { $or: [{ usernameLower: name.toLowerCase() }, { username: { $regex: `^${escapeRegex(name)}$`, $options: "i" } }] },
      { projection: { _id: 1 } },
    );
    return !!doc;
  }

  async emailTaken(email: string) {
    const { users } = await this.accountCols();
    return !!(await users.findOne({ emailLower: email.trim().toLowerCase() }, { projection: { _id: 1 } }));
  }

  async createAccount(a: Account, startExp: number) {
    const { users } = await this.accountCols();
    try {
      const now = new Date().toISOString();
      await users.insertOne({
        username: a.username,
        usernameLower: a.username.toLowerCase(),
        email: a.email,
        emailLower: a.email.toLowerCase(),
        passwordHash: a.passwordHash,
        role: a.role,
        currentExp: startExp,
        avatar: null,
        createdAt: now,
        emailVerifiedAt: now,
      });
      return true;
    } catch (e) {
      if ((e as { code?: number })?.code === 11000) return false; // taken in the meantime
      throw e;
    }
  }

  async setPasswordHash(email: string, passwordHash: string) {
    const { users } = await this.accountCols();
    const r = await users.updateOne({ emailLower: email.trim().toLowerCase() }, { $set: { passwordHash } });
    return r.matchedCount > 0;
  }

  async saveOtp(o: OtpDoc) {
    const { otps } = await this.accountCols();
    await otps.replaceOne({ emailLower: o.emailLower, purpose: o.purpose }, o, { upsert: true });
  }

  async getOtp(email: string, purpose: OtpPurpose) {
    const { otps } = await this.accountCols();
    return otps.findOne({ emailLower: email.trim().toLowerCase(), purpose }, { projection: { _id: 0 } });
  }

  async bumpOtpAttempts(email: string, purpose: OtpPurpose) {
    const { otps } = await this.accountCols();
    await otps.updateOne({ emailLower: email.trim().toLowerCase(), purpose }, { $inc: { attempts: 1 } });
  }

  async deleteOtp(email: string, purpose: OtpPurpose) {
    const { otps } = await this.accountCols();
    await otps.deleteOne({ emailLower: email.trim().toLowerCase(), purpose });
  }
}

// ── In-memory demo implementation ──────────────────────────────────────

class MemoryStore implements Store {
  readonly mode = "memory" as const;
  async warmUp() {}
  private reports = new Map<string, ReportDoc>();
  private users = new Map<string, { exp: number; avatar: string | null; role: Role }>();
  private accounts = new Map<string, Account>(); // key: lower-case username
  private otps = new Map<string, OtpDoc>(); // key: email|purpose
  private seq = 1;

  constructor() {
    for (const r of seedReports()) {
      const id = `demo-${this.seq++}`;
      this.reports.set(id, { ...r, _id: id });
    }
    // Sample residents so the demo leaderboard isn't empty.
    for (const [name, exp, avatar] of [
      ["Resident5", 1240, "bot-1"],
      ["Resident2", 820, "notion-1"],
      ["Resident3", 430, "lorelei-3"],
      ["Resident4", 260, "thumbs-2"],
    ] as const) {
      this.users.set(name, { exp, avatar, role: "resident" });
    }
  }

  async listReports() {
    return [...this.reports.values()]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(toReport);
  }

  async getReportDoc(id: string) {
    return this.reports.get(id) ?? null;
  }

  async getReport(id: string) {
    const doc = this.reports.get(id);
    return doc ? toReport(doc) : null;
  }

  async getImage(id: string, kind: "photo" | "proof") {
    const doc = this.reports.get(id);
    const v = kind === "proof" ? doc?.proofOfWorkImageUrl : doc?.imageBase64;
    return v || null;
  }

  async createReport(doc: NewReport) {
    const id = `demo-${this.seq++}`;
    const full = { ...doc, _id: id };
    this.reports.set(id, full);
    return toReport(full);
  }

  async updateReportIf(id: string, expect: Partial<ReportDoc>, patch: ReportPatch) {
    const doc = this.reports.get(id);
    if (!doc) return null;
    if (expect.status !== undefined && parseStatus(doc.status) !== expect.status) return null;
    if (expect.assignedVolunteerId !== undefined && doc.assignedVolunteerId !== expect.assignedVolunteerId) return null;
    const next = { ...doc, ...patch };
    this.reports.set(id, next);
    return toReport(next);
  }

  async deleteResolvedBefore(cutoff: Date) {
    let n = 0;
    for (const [id, d] of this.reports) {
      if (parseStatus(d.status) !== "resolved" || !d.fixedAt) continue;
      const t = new Date(d.fixedAt).getTime();
      if (!Number.isNaN(t) && t < cutoff.getTime()) {
        this.reports.delete(id);
        n++;
      }
    }
    return n;
  }

  async listOpenInBox(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }) {
    return [...this.reports.values()]
      .filter(
        (d) =>
          parseStatus(d.status) !== "resolved" &&
          d.latitude >= box.minLat && d.latitude <= box.maxLat &&
          d.longitude >= box.minLng && d.longitude <= box.maxLng,
      )
      .map(toReport);
  }

  async addConfirmation(id: string, username: string) {
    const doc = this.reports.get(id);
    if (!doc || parseStatus(doc.status) === "resolved" || doc.reportedBy === username) return null;
    const list = doc.confirmations ?? [];
    if (list.includes(username)) return null;
    const next = { ...doc, confirmations: [...list, username] };
    this.reports.set(id, next);
    return toReport(next);
  }

  async getOrSeedExp(username: string, defaultExp: number) {
    return (await this.getOrSeedUser(username, defaultExp, "resident")).currentExp;
  }

  async getOrSeedUser(username: string, defaultExp: number, role: Role) {
    const u = this.users.get(username) ?? { exp: defaultExp, avatar: null, role };
    u.role = role;
    this.users.set(username, u);
    return { currentExp: u.exp, avatar: u.avatar };
  }

  async setAvatar(username: string, avatar: string) {
    const u = this.users.get(username) ?? { exp: 0, avatar: null, role: "resident" as Role };
    this.users.set(username, { ...u, avatar });
  }

  async leaderboard(limit: number) {
    return [...this.users.entries()]
      .filter(([, u]) => u.role !== "cityAdmin")
      .map(([username, u]) => ({ username, currentExp: u.exp, avatar: u.avatar }))
      .sort((a, b) => b.currentExp - a.currentExp || a.username.localeCompare(b.username))
      .slice(0, limit);
  }

  async awardExp(username: string, delta: number) {
    const u = this.users.get(username) ?? { exp: 0, avatar: null, role: "resident" as Role };
    u.exp += delta;
    this.users.set(username, u);
    return u.exp;
  }
  // ── accounts (demo mode: kept in memory until the server restarts) ──
  async findAccount(usernameOrEmail: string) {
    const key = usernameOrEmail.trim().toLowerCase();
    return this.accounts.get(key) ?? [...this.accounts.values()].find((a) => a.email.toLowerCase() === key) ?? null;
  }

  async usernameTaken(username: string) {
    const key = username.trim().toLowerCase();
    return this.accounts.has(key) || [...this.users.keys()].some((u) => u.toLowerCase() === key);
  }

  async emailTaken(email: string) {
    const key = email.trim().toLowerCase();
    return [...this.accounts.values()].some((a) => a.email.toLowerCase() === key);
  }

  async createAccount(a: Account, startExp: number) {
    if ((await this.usernameTaken(a.username)) || (await this.emailTaken(a.email))) return false;
    this.accounts.set(a.username.toLowerCase(), a);
    this.users.set(a.username, { exp: startExp, avatar: null, role: a.role });
    return true;
  }

  async setPasswordHash(email: string, passwordHash: string) {
    const a = await this.findAccount(email);
    if (!a) return false;
    a.passwordHash = passwordHash;
    return true;
  }

  async saveOtp(o: OtpDoc) {
    this.otps.set(`${o.emailLower}|${o.purpose}`, { ...o });
  }

  async getOtp(email: string, purpose: OtpPurpose) {
    const o = this.otps.get(`${email.trim().toLowerCase()}|${purpose}`);
    if (!o || o.expiresAt.getTime() < Date.now()) return null;
    return { ...o };
  }

  async bumpOtpAttempts(email: string, purpose: OtpPurpose) {
    const o = this.otps.get(`${email.trim().toLowerCase()}|${purpose}`);
    if (o) o.attempts++;
  }

  async deleteOtp(email: string, purpose: OtpPurpose) {
    this.otps.delete(`${email.trim().toLowerCase()}|${purpose}`);
  }

}

function seedImage(file: string): string | null {
  const p = path.join(process.cwd(), "public", "seed", file);
  return existsSync(p) ? readFileSync(p).toString("base64") : null;
}

function daysAgo(d: number, h = 9): string {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() - d);
  t.setUTCHours(h, 0, 0, 0);
  return t.toISOString();
}

/** Seven sample reports around Ras Al Khaimah, mirroring the pitch demo. */
function seedReports(): NewReport[] {
  const base = (r: Partial<NewReport> & Pick<NewReport, "category" | "severity" | "description" | "latitude" | "longitude" | "address">): NewReport => ({
    priority: priorityFromSeverity(r.severity),
    imageBase64: null,
    status: "open",
    createdAt: daysAgo(3),
    fixedAt: null,
    assignedVolunteerId: null,
    proofOfWorkImageUrl: null,
    confirmations: [],
    // Seed reports come from "other residents" so the demo accounts can
    // confirm them ("I see this too").
    reportedBy: "Resident5",
    ...r,
  });
  return [
    base({
      category: "Exposed Wiring", severity: 10,
      description: "The image shows exposed and tangled wiring on a building.",
      descriptionAr: "تُظهر الصورة أسلاكاً مكشوفة ومتشابكة على أحد المباني.",
      latitude: 25.7928, longitude: 55.9561,
      address: "685 Al Muntasir Rd, Al Mamourah, Ras Al Khaimah",
      imageBase64: seedImage("wiring.jpg"), createdAt: daysAgo(5, 8),
      confirmations: ["Resident2", "Resident3", "Resident4"],
    }),
    base({
      category: "Broken Street Lights", severity: 6,
      description: "The street light's glass cover is broken and damaged.",
      descriptionAr: "الغطاء الزجاجي لعمود الإنارة مكسور ومتضرر.",
      latitude: 25.7428, longitude: 55.9214,
      address: "21 55A St, Al Kharan, Ras Al Khaimah",
      imageBase64: seedImage("streetlight.jpg"), createdAt: daysAgo(5, 9),
    }),
    base({
      category: "Illegal Dumping", severity: 5,
      description: "Construction debris and household waste dumped on open ground.",
      descriptionAr: "مخلفات بناء ونفايات منزلية مرمية على أرض مفتوحة.",
      latitude: 25.7716, longitude: 55.9437,
      address: "231 Ibn Sina St, Khuzam, Ras Al Khaimah",
      imageBase64: seedImage("dumping.jpg"), createdAt: daysAgo(5, 10),
      confirmations: ["Resident2"],
    }),
    base({
      category: "Graffiti", severity: 3,
      description: "Spray-painted graffiti covers part of a boundary wall.",
      descriptionAr: "كتابات مرسومة بالرذاذ تغطي جزءاً من سور.",
      latitude: 25.7781, longitude: 55.9654,
      address: "10 4B St, Al Qussaidat, Ras Al Khaimah",
      imageBase64: seedImage("graffiti2.jpg"), createdAt: daysAgo(2, 12),
    }),
    base({
      category: "Graffiti", severity: 3,
      description: "The wall has been vandalized with graffiti. The graffiti appears to be colorful and stylized letters.",
      descriptionAr: "تعرّض الجدار للتشويه بكتابات ملونة بحروف مزخرفة.",
      latitude: 25.70969, longitude: 55.85569,
      address: "1 302C St, Al Riffa, Ras Al Khaimah",
      imageBase64: seedImage("graffiti.jpg"), createdAt: daysAgo(2, 14),
      status: "pending_verification", assignedVolunteerId: "Resident1",
      proofOfWorkImageUrl: seedImage("proof.jpg"),
    }),
    base({
      category: "Broken Signs", severity: 3,
      description: "A street sign is bent and partly detached from its pole.",
      descriptionAr: "لافتة طريق منحنية ومنفصلة جزئياً عن عمودها.",
      latitude: 25.7605, longitude: 55.9312,
      address: "Al Nakheel, Ras Al Khaimah",
      imageBase64: seedImage("sign.jpg"), createdAt: daysAgo(1, 10),
      status: "in_progress", assignedVolunteerId: "Resident1",
    }),
    base({
      category: "Litter Accumulation", severity: 1,
      description: "Trash scattered on the road.",
      descriptionAr: "قمامة متناثرة على الطريق.",
      latitude: 25.79052, longitude: 55.98663,
      address: "22 37B St, Al Hudeeba, Ras Al Khaimah",
      imageBase64: seedImage("litter.jpg"), createdAt: daysAgo(0, 8),
    }),
  ];
}

// ── singleton ─────────────────────────────────────────────────────────

const globalForStore = globalThis as unknown as { __fmsStore?: Store };

/**
 * Forgives the usual copy-paste mistakes in .env.local: surrounding quotes,
 * angle brackets, stray spaces, or the variable name pasted twice.
 */
function cleanMongoUri(raw: string | undefined): string {
  let v = (raw ?? "").trim();
  v = v.replace(/^MONGODB_URI\s*=\s*/i, "");
  v = v.replace(/^["'<\s]+|["'>\s]+$/g, "");
  return v;
}

export function getStore(): Store {
  if (!globalForStore.__fmsStore) {
    const uri = cleanMongoUri(process.env.MONGODB_URI);
    globalForStore.__fmsStore = uri
      ? new MongoStore(uri, process.env.MONGODB_DB?.trim() || "FixMyStreet")
      : new MemoryStore();
  }
  return globalForStore.__fmsStore;
}
