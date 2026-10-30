import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, SessionUser } from "./types";
import { checkAccount } from "./accounts";

const COOKIE = "fms_session";
const REMEMBER_S = 60 * 60 * 24 * 30; // "Remember me": 30 days
const SESSION_S = 60 * 60 * 12; // otherwise: at most 12 hours…

/**
 * …and only until the server restarts. Each start of the site gets a new
 * id; sign-ins without "Remember me" are tied to it. (Shared through
 * globalThis because Next.js can load this file more than once.)
 */
const g = globalThis as unknown as { __tareeqBoot?: string };
const BOOT_ID = (g.__tareeqBoot ??= randomUUID());

/**
 * Prototype accounts, identical to the Android app. Checked on the server
 * only — the passwords never reach the browser bundle.
 */
const DEMO_ACCOUNTS: Record<string, { password: string; role: Role }> = {
  Resident1: { password: "123", role: "resident" },
  CityAdmin: { password: "12345", role: "cityAdmin" },
};

function secret(): string {
  return process.env.SESSION_SECRET?.trim() || "fixmystreet-dev-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(user: SessionUser, remember: boolean): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify(
      remember ? { ...user, exp: now + REMEMBER_S, r: 1 } : { ...user, exp: now + SESSION_S, r: 0, b: BOOT_ID },
    ),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    // Not remembered + server restarted. Skipped on Vercel, which runs several
    // copies of the server at once (each with its own BOOT_ID), so this check
    // would log people out at random there. The 12-hour limit still applies.
    if (data.r !== 1 && data.b !== BOOT_ID && !process.env.VERCEL) return null;
    if (typeof data.username !== "string" || !data.username) return null;
    // Built-in demo accounts keep their fixed role; signed-up accounts carry
    // the role we put in the (signed, tamper-proof) cookie.
    if (DEMO_ACCOUNTS[data.username]) return { username: data.username, role: DEMO_ACCOUNTS[data.username].role };
    return { username: data.username, role: data.role === "cityAdmin" ? "cityAdmin" : "resident" };
  } catch {
    return null;
  }
}

/** Demo accounts first, then signed-up accounts (by username or email). */
export async function checkCredentials(username: string, password: string): Promise<SessionUser | null> {
  const acct = DEMO_ACCOUNTS[username.trim()];
  if (acct) return acct.password === password.trim() ? { username: username.trim(), role: acct.role } : null;
  return checkAccount(username, password);
}

/**
 * remember = stay signed in for 30 days.
 * Otherwise the sign-in ends when the browser closes, after 12 hours, or when
 * the site restarts — whichever comes first.
 */
export async function startSession(user: SessionUser, remember = false) {
  const jar = await cookies();
  jar.set(COOKIE, encode(user, remember), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_S } : {}),
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return decode(jar.get(COOKIE)?.value);
}

/** For pages: returns the user or redirects to the login screen. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}
