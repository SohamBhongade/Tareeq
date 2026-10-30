import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "./auth";
import type { SessionUser } from "./types";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

/** Wraps a handler: requires a session and maps known errors to JSON. */
export function withUser<A extends unknown[]>(
  handler: (user: SessionUser, ...args: A) => Promise<Response>,
) {
  return async (...args: A): Promise<Response> => {
    const user = await getSession();
    if (!user) return fail("Please sign in again.", 401);
    try {
      return await handler(user, ...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** For routes anyone may call (sign-in, sign-up): same friendly error handling, no session needed. */
export function publicRoute<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

function errorResponse(e: unknown): Response {
  // Match on error name, not instanceof: Next.js can bundle a module
  // into more than one chunk, so class identity isn't reliable.
  const err = e as { name?: string; message?: string; status?: number; userMessage?: string };
  if (err?.name === "DuplicateError") {
    return json({ error: err.message, duplicates: (e as { matches?: unknown }).matches ?? [] }, 409);
  }
  if (err?.name === "RuleError") return fail(err.message ?? "Not allowed.", err.status ?? 409);
  if (err?.name === "AIError") return fail(err.userMessage ?? "AI error.", err.status ?? 502);
  if (err?.name === "MailError") return fail(err.userMessage ?? "Couldn't send the email.", 502);
  if (err?.name === "DatabaseUnavailableError") return fail("Can't reach the database right now. Please try again shortly.", 503);
  console.error("[api]", e);
  return fail("Something went wrong on the server. Please try again.", 500);
}

/** Strips an optional data-URI prefix and rejects anything that isn't an image. */
export function cleanImage(value: unknown, maxBytes = 6_000_000): { base64: string; mime: string } | null {
  if (typeof value !== "string" || !value) return null;
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(value);
  const base64 = m ? m[2] : value;
  const mime = m ? m[1].toLowerCase() : "image/jpeg";
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64.slice(0, 200))) return null;
  if ((base64.length * 3) / 4 > maxBytes) return null;
  return { base64: base64.replace(/\s/g, ""), mime };
}
