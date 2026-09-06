/**
 * TOTP two-factor auth (RFC 6238, built on RFC 4226 HOTP) — hand-rolled on
 * Node's built-in crypto only, no third-party auth library. The algorithm
 * itself is simple: HMAC-SHA1 over a moving time counter, then a standard
 * truncation into a 6-digit code. Any TOTP app (Google Authenticator, Authy,
 * 1Password, etc.) already knows this exact algorithm — that's the point of
 * it being a published RFC rather than a bespoke scheme.
 */
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}
function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A fresh random secret, base32-encoded for both storage and display. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = ((hmac[offset]! & 0x7f) << 24) | ((hmac[offset + 1]! & 0xff) << 16) | ((hmac[offset + 2]! & 0xff) << 8) | (hmac[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

const TOTP_STEP_SECONDS = 30;

/** The current 6-digit code for a secret — mainly for tests; the app itself only verifies. */
export function currentTotpCode(secret: string, atMs = Date.now()): string {
  return hotp(secret, Math.floor(atMs / 1000 / TOTP_STEP_SECONDS));
}

/** Accepts the current time step and one step on either side (±30s of clock
 *  drift) — tight enough to stay meaningful, loose enough that a slightly
 *  slow phone clock doesn't lock someone out. */
export function verifyTotp(secret: string, token: string, atMs = Date.now()): boolean {
  const clean = token.trim();
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);
  for (const drift of [0, -1, 1]) {
    const expected = hotp(secret, counter + drift);
    const a = Buffer.from(expected), b = Buffer.from(clean);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Standard otpauth:// URI — any authenticator app can scan or import this. */
export function totpUri(secret: string, accountEmail: string, issuer = "OneVYRT"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}

/** One-time recovery codes for when the authenticator device is unavailable.
 *  Returned in plaintext once, at generation time — only their hashes are
 *  ever stored, same principle as password reset tokens. */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = randomInt(0, 1_000_000_000);
    codes.push(n.toString(36).padStart(6, "0").toUpperCase());
  }
  return codes;
}
export function hashBackupCode(code: string, secretPepper: string): string {
  return createHmac("sha256", secretPepper).update(code.trim().toUpperCase()).digest("hex");
}
