import "server-only";
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getStore, type OtpPurpose } from "./store";
import { sendCode } from "./mailer";
import { RuleError } from "./reports";
import { DEFAULT_RESIDENT_EXP, type SessionUser } from "./types";
import type { Lang } from "./i18n";

/*
 * Sign-up, email codes and password resets.
 *
 * • Passwords are never stored — only a scrypt hash with a random salt.
 * • Codes are 6 digits, work for 10 minutes, allow 5 tries, and can be
 *   re-sent after 45 seconds. Only a hash of the code is stored.
 */

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1 };

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_AFTER_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

/** Names nobody can sign up with. */
const RESERVED = new Set(["resident1", "cityadmin", "admin", "administrator", "tareeq", "citycrew", "city_crew", "support", "moderator"]);

export const USERNAME_RULE = /^[A-Za-z0-9_.]{3,20}$/;
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [kind, saltB64, keyB64] = stored.split("$");
  if (kind !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return timingSafeEqual(key, expected);
}

const secret = () => process.env.SESSION_SECRET?.trim() || "fixmystreet-dev-secret-change-me";
const hashCode = (email: string, purpose: OtpPurpose, code: string) =>
  createHash("sha256").update(`${secret()}|${email.toLowerCase()}|${purpose}|${code}`).digest("hex");

function cleanEmail(raw: unknown): string {
  const email = String(raw ?? "").trim();
  if (!EMAIL_RULE.test(email) || email.length > 254) throw new RuleError("Please enter a valid email address.", 400);
  return email;
}

function checkNewPassword(raw: unknown): string {
  const pw = String(raw ?? "");
  if (pw.length < 8) throw new RuleError("Use at least 8 characters for your password.", 400);
  if (pw.length > 128) throw new RuleError("That password is too long (128 characters max).", 400);
  return pw;
}

/** What the browser is told after a code is sent. `demoCode` only when email isn't set up. */
export interface CodeSent {
  email: string;
  emailed: boolean;
  demoCode?: string;
  resendInSeconds: number;
}

async function issueCode(
  email: string,
  purpose: OtpPurpose,
  name: string | undefined,
  pending?: { username: string; email: string; passwordHash: string },
  /** May the code be shown on screen when email isn't set up? Never for password resets on a real database. */
  allowDemo = true,
  lang: Lang = "en",
): Promise<CodeSent> {
  const store = getStore();
  const existing = await store.getOtp(email, purpose);
  if (existing && Date.now() - new Date(existing.sentAt).getTime() < RESEND_AFTER_MS) {
    const wait = Math.ceil((RESEND_AFTER_MS - (Date.now() - new Date(existing.sentAt).getTime())) / 1000);
    throw new RuleError(`Please wait ${wait} seconds before asking for another code.`, 429);
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await store.saveOtp({
    emailLower: email.toLowerCase(),
    purpose,
    codeHash: hashCode(email, purpose, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    sentAt: new Date(),
    attempts: 0,
    ...(pending ? { pending } : {}),
  });
  const emailed = await sendCode(email, purpose, code, name, lang);
  if (!emailed && !allowDemo) {
    await store.deleteOtp(email, purpose);
    throw new RuleError("Password-reset emails aren't set up on this site yet. Ask the site owner to add the Gmail settings.", 503);
  }
  return { email, emailed, ...(emailed ? {} : { demoCode: code }), resendInSeconds: RESEND_AFTER_MS / 1000 };
}

/** Throws a friendly error unless [code] is right; deletes the code once used. */
async function useCode(email: string, purpose: OtpPurpose, rawCode: unknown) {
  const store = getStore();
  const code = String(rawCode ?? "").replace(/\D/g, "");
  const otp = await store.getOtp(email, purpose);
  if (!otp || new Date(otp.expiresAt).getTime() < Date.now()) {
    throw new RuleError("That code has expired. Ask for a new one.", 410);
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new RuleError("Too many wrong tries. Ask for a new code.", 429);
  }
  const a = Buffer.from(otp.codeHash, "hex");
  const b = Buffer.from(hashCode(email, purpose, code), "hex");
  if (code.length !== 6 || a.length !== b.length || !timingSafeEqual(a, b)) {
    const left = MAX_ATTEMPTS - otp.attempts - 1;
    await store.bumpOtpAttempts(email, purpose);
    throw new RuleError(left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Ask for a new code.", 400);
  }
  await store.deleteOtp(email, purpose);
  return otp;
}

// ── sign-up ─────────────────────────────────────────────────────────────

export async function startSignup(body: { username?: unknown; email?: unknown; password?: unknown }, lang: Lang = "en"): Promise<CodeSent> {
  const username = String(body.username ?? "").trim();
  if (!USERNAME_RULE.test(username)) {
    throw new RuleError("Usernames are 3–20 characters: letters, numbers, _ or . only.", 400);
  }
  if (RESERVED.has(username.toLowerCase())) throw new RuleError("That username isn't available.", 409);
  const email = cleanEmail(body.email);
  const password = checkNewPassword(body.password);

  const store = getStore();
  const [nameTaken, emailTaken] = await Promise.all([store.usernameTaken(username), store.emailTaken(email)]);
  if (nameTaken) throw new RuleError("That username is already taken.", 409);
  if (emailTaken) throw new RuleError("An account with this email already exists. Try signing in.", 409);

  return issueCode(email, "signup", username, { username, email, passwordHash: await hashPassword(password) }, true, lang);
}

export async function finishSignup(body: { email?: unknown; code?: unknown }): Promise<SessionUser> {
  const email = cleanEmail(body.email);
  const otp = await useCode(email, "signup", body.code);
  if (!otp.pending) throw new RuleError("Something went wrong. Please sign up again.", 400);
  const created = await getStore().createAccount(
    { username: otp.pending.username, email: otp.pending.email, passwordHash: otp.pending.passwordHash, role: "resident" },
    DEFAULT_RESIDENT_EXP,
  );
  if (!created) throw new RuleError("That username or email was just taken. Please sign up again.", 409);
  return { username: otp.pending.username, role: "resident" };
}

export async function resendSignup(body: { email?: unknown }, lang: Lang = "en"): Promise<CodeSent> {
  const email = cleanEmail(body.email);
  const otp = await getStore().getOtp(email, "signup");
  if (!otp?.pending) throw new RuleError("Your sign-up timed out. Please fill in the form again.", 410);
  return issueCode(email, "signup", otp.pending.username, otp.pending, true, lang);
}

// ── forgot password ─────────────────────────────────────────────────────

/** Always answers the same way, so nobody can test which emails have accounts. */
export async function startReset(body: { email?: unknown }, lang: Lang = "en"): Promise<CodeSent> {
  const email = cleanEmail(body.email);
  const account = await getStore().findAccount(email);
  if (!account || account.email.toLowerCase() !== email.toLowerCase()) {
    return { email, emailed: true, resendInSeconds: RESEND_AFTER_MS / 1000 };
  }
  return issueCode(account.email, "reset", account.username, undefined, getStore().mode === "memory", lang);
}

export async function finishReset(body: { email?: unknown; code?: unknown; password?: unknown }): Promise<void> {
  const email = cleanEmail(body.email);
  const password = checkNewPassword(body.password);
  await useCode(email, "reset", body.code);
  const ok = await getStore().setPasswordHash(email, await hashPassword(password));
  if (!ok) throw new RuleError("No account uses this email.", 404);
}

// ── sign-in ─────────────────────────────────────────────────────────────

/** Checks a signed-up account by username or email. */
export async function checkAccount(usernameOrEmail: string, password: string): Promise<SessionUser | null> {
  if (!usernameOrEmail.trim() || !password) return null;
  const account = await getStore().findAccount(usernameOrEmail);
  if (!account || !(await checkPassword(password, account.passwordHash))) return null;
  return { username: account.username, role: account.role };
}
