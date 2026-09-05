import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

// `util.promisify` can't resolve scrypt's options-object overload cleanly,
// so wrap it by hand instead of fighting the overload resolution.
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// scrypt cost parameters. N=2^15 targets roughly 50-100ms on typical
// server hardware - a "current memory-hard method with secure parameters"
// per §11, without the extra dependency an Argon2 binding would add.
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// scrypt's actual memory use is ~128 * N * r bytes; Node's default `maxmem`
// (32MB) sits right at that boundary for N=2^15/r=8 and OpenSSL's own
// overhead pushes it over, so this must be requested explicitly rather
// than relying on the default.
function requiredMaxMem(n: number, r: number, p: number): number {
  return 128 * n * r * p * 2; // 2x headroom
}

/** Format: scrypt$N$r$p$saltHex$hashHex - self-describing so parameters can change later without breaking old hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: requiredMaxMem(SCRYPT_N, SCRYPT_R, SCRYPT_P),
  });

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const salt = Buffer.from(saltHex!, "hex");
  const expected = Buffer.from(hashHex!, "hex");

  const derivedKey = await scrypt(password, salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: requiredMaxMem(n, r, p),
  });

  // Buffers must be equal length for timingSafeEqual; a length mismatch
  // means the stored hash is malformed/tampered, so treat it as a failed
  // verification rather than throwing.
  if (derivedKey.length !== expected.length) return false;
  return timingSafeEqual(derivedKey, expected);
}
