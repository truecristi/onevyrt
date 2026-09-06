/**
 * KNOWN GAP: Share-link infrastructure for Growth & Improvement Plan.
 * This module implements stateless, HMAC-signed tokens (no database row, nothing
 * to garbage-collect) — like lib/reports/share-link.ts for Transformation Reports.
 * A link is a self-contained bearer credential valid for SHARE_TTL_MS.
 *
 * Status: Infrastructure complete. Not yet wired to UI routes or share button.
 * See app/programme/chapter-4/growth-plan/page.tsx (lines 19–22) and
 * docs/IMPLEMENTATION_ROADMAP.md for the feature's implementation roadmap.
 *
 * Same signed-token idiom as lib/auth.ts's signSession/verifySession and
 * lib/reports/share-link.ts's generateShareLink/verifyShareToken:
 * base64url(JSON payload) + "." + HMAC-SHA256(payload), verified with
 * timingSafeEqual. verifyShareToken() only decodes/validates the token shape
 * and expiry (pure, no I/O); actual plan fetching is the caller's responsibility
 * (enables caching, rate limiting, etc. at the route level).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * A Growth & Improvement Plan link is meant to be shared once by the workspace
 * owner (similar to Transformation Report), not kept indefinitely.
 */
const SHARE_TTL_MS = 24 * 3600 * 1000;

/**
 * Signing key for share tokens. Prefers a dedicated secret, then
 * AUTH_SECRET, then DATABASE_URL — all stable per-install and already
 * secret, so a working link needs no new required env var.
 */
function shareLinkKey(): Buffer {
  const raw = process.env.GROWTH_PLAN_SHARE_SECRET || process.env.AUTH_SECRET || process.env.DATABASE_URL || "onevyrt-dev-growth-plan-share-secret";
  return createHash("sha256").update(raw, "utf8").digest();
}

interface SharePayload {
  w: string; // workspace id
  exp: number; // expiry timestamp
  n?: string; // nonce — see generateGrowthPlanShareLink; ignored by verify
}

/**
 * Mints a signed link for one workspace's Growth & Improvement Plan, valid
 * for SHARE_TTL_MS from now. The workspace id is embedded in the token and
 * verified on view — no separate "report id" stored.
 *
 * `n` is a random nonce with no meaning to verifyGrowthPlanShareToken (which
 * only ever reads `w`/`exp`) — its only job is making two links minted for
 * the same workspace in the same millisecond come out byte-different, same
 * as re-clicking "Share" twice would visibly produce two different URLs.
 * Without it the payload is pure function of (workspaceId, expiresAt), so a
 * fast back-to-back mint (same millisecond) collides into one identical
 * token — harmless to verification, but not what "get a fresh link" implies.
 */
export function generateGrowthPlanShareLink(workspaceId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SHARE_TTL_MS;
  const nonce = randomBytes(6).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ w: workspaceId, exp: expiresAt, n: nonce })).toString("base64url");
  const sig = createHmac("sha256", shareLinkKey()).update(payload).digest("base64url");
  return { token: `${payload}.${sig}`, expiresAt };
}

/**
 * Verifies signature/shape/expiry only — pure, no I/O. Returns the
 * workspace id the token was minted for and its expiry, or null for anything
 * malformed, tampered with, or past its expiry.
 */
export function verifyGrowthPlanShareToken(token: string | null | undefined): { workspaceId: string; expiresAt: number } | null {
  if (!token || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", shareLinkKey()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  // Unequal lengths can't be compared in constant time — and mean a mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SharePayload>;
    if (typeof parsed.w !== "string" || !parsed.w || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return { workspaceId: parsed.w, expiresAt: parsed.exp };
  } catch {
    return null;
  }
}
