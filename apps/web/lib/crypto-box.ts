/**
 * Symmetric encryption for secrets we must store server-side but never want
 * sitting in the database as plaintext — currently the user's own BYO-AI API
 * key (lib/ai-connection-store.ts).
 *
 * AES-256-GCM (authenticated: tampering is detected on decrypt) with a 32-byte
 * key derived by SHA-256 from the AI_ENCRYPTION_KEY environment variable. That
 * env var must be STABLE across restarts and included in the server's env
 * backup — rotate it and every stored ciphertext becomes undecryptable.
 *
 * Graceful fallback: when AI_ENCRYPTION_KEY is unset, encryptSecret/
 * decryptSecret return null. Callers treat null as "server-side secret storage
 * isn't configured" and fall back to browser-only behaviour, so the feature is
 * safe to deploy before the env var is ever set.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const VERSION = "v1";

/** 32-byte key from the env secret, or null when unconfigured. Recomputed each
 *  call (cheap SHA-256) so a mid-process env change is picked up in dev. */
function keyFromEnv(): Buffer | null {
  const raw = process.env.AI_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) return null;
  return createHash("sha256").update(raw, "utf8").digest(); // always 32 bytes
}

/** True when server-side secret storage is available (env key set). */
export function secretStorageConfigured(): boolean {
  return keyFromEnv() !== null;
}

/**
 * Encrypt a plaintext secret to a self-describing string
 * `v1:<iv>:<tag>:<ciphertext>` (all hex). Returns null when no key is
 * configured, or for empty input (nothing to protect).
 */
export function encryptSecret(plain: string): string | null {
  const key = keyFromEnv();
  if (!key) return null;
  if (!plain) return null;
  const iv = randomBytes(12); // 96-bit nonce, the GCM standard
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

/**
 * Decrypt a string produced by encryptSecret. Returns null when no key is
 * configured, the format is unrecognised, or authentication fails (wrong key
 * or tampered ciphertext) — never throws, so a bad/rotated key degrades to
 * "no stored secret" instead of crashing the request.
 */
export function decryptSecret(payload: string | null | undefined): string | null {
  const key = keyFromEnv();
  if (!key || !payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const iv = Buffer.from(parts[1]!, "hex");
    const tag = Buffer.from(parts[2]!, "hex");
    const ct = Buffer.from(parts[3]!, "hex");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong key / tampered / malformed
  }
}
