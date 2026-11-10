import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Anti-AI check, layer 3 (server lock).
 *
 * /api/analyze hands out a signed "photo pass" only for a photo that passed
 * the AI-image check. /api/reports refuses any photo without a valid pass for
 * that exact image and user — so skipping the check in the browser, or
 * swapping the photo after it was checked, doesn't work.
 */

const VALID_MS = 2 * 60 * 60 * 1000; // a pass lasts 2 hours

function secret(): string {
  return process.env.SESSION_SECRET?.trim() || "fixmystreet-dev-secret-change-me";
}

const hashImage = (base64: string) => createHash("sha256").update(base64).digest("base64url");
const sign = (text: string) => createHmac("sha256", secret()).update(`photo-pass:${text}`).digest("base64url");

export function issuePhotoPass(username: string, base64: string): string {
  const issued = Date.now().toString(36);
  return `${issued}.${sign(`${username}|${hashImage(base64)}|${issued}`)}`;
}

export function checkPhotoPass(pass: unknown, username: string, base64: string): boolean {
  if (typeof pass !== "string") return false;
  const [issued, sig] = pass.split(".");
  if (!issued || !sig) return false;
  const at = parseInt(issued, 36);
  if (!Number.isFinite(at) || Date.now() - at > VALID_MS || at > Date.now() + 60_000) return false;
  const expected = Buffer.from(sign(`${username}|${hashImage(base64)}|${issued}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
