import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

const SESSION_TOKEN_BYTES = 32;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Sessions store only an HMAC of the token (keyed by AUTH_SECRET), never the
 * raw token - matching the password-hashing rule of never persisting a
 * usable credential. The raw token is what goes in the cookie.
 */
export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string, authSecret: string): string {
  return createHmac("sha256", authSecret).update(token).digest("hex");
}

export function verifySessionTokenHash(
  token: string,
  authSecret: string,
  storedHash: string,
): boolean {
  const computed = Buffer.from(hashSessionToken(token, authSecret), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}

export function newSessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}

export function isSessionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
