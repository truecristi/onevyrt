import test from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret, secretStorageConfigured } from "../lib/crypto-box";

// keyFromEnv() re-reads process.env.AI_ENCRYPTION_KEY on every call, so tests
// toggle it directly. Save/restore around each block to stay independent.
function withKey<T>(key: string | undefined, fn: () => T): T {
  const prev = process.env.AI_ENCRYPTION_KEY;
  if (key === undefined) delete process.env.AI_ENCRYPTION_KEY;
  else process.env.AI_ENCRYPTION_KEY = key;
  try { return fn(); } finally {
    if (prev === undefined) delete process.env.AI_ENCRYPTION_KEY;
    else process.env.AI_ENCRYPTION_KEY = prev;
  }
}

test("round-trips a secret through encrypt → decrypt", () => {
  withKey("a-stable-server-secret", () => {
    const secret = "sk-or-v1-abcdef1234567890";
    const cipher = encryptSecret(secret);
    assert.ok(cipher && cipher.startsWith("v1:"), "ciphertext is versioned");
    assert.notEqual(cipher, secret, "ciphertext is not the plaintext");
    assert.equal(decryptSecret(cipher), secret);
  });
});

test("two encryptions of the same secret differ (random IV) but both decrypt", () => {
  withKey("a-stable-server-secret", () => {
    const a = encryptSecret("same-key");
    const b = encryptSecret("same-key");
    assert.notEqual(a, b, "IV randomises the ciphertext");
    assert.equal(decryptSecret(a), "same-key");
    assert.equal(decryptSecret(b), "same-key");
  });
});

test("no env key → storage unconfigured, encrypt/decrypt return null", () => {
  withKey(undefined, () => {
    assert.equal(secretStorageConfigured(), false);
    assert.equal(encryptSecret("x"), null);
    assert.equal(decryptSecret("v1:aa:bb:cc"), null);
  });
});

test("empty input encrypts to null (nothing to protect)", () => {
  withKey("a-stable-server-secret", () => {
    assert.equal(secretStorageConfigured(), true);
    assert.equal(encryptSecret(""), null);
  });
});

test("a tampered ciphertext fails authentication → null, never throws", () => {
  withKey("a-stable-server-secret", () => {
    const cipher = encryptSecret("tamper-me")!;
    const parts = cipher.split(":");
    // flip the last hex char of the ciphertext body
    const body = parts[3]!;
    const flipped = body.slice(0, -1) + (body.slice(-1) === "0" ? "1" : "0");
    const tampered = [parts[0], parts[1], parts[2], flipped].join(":");
    assert.equal(decryptSecret(tampered), null);
    assert.equal(decryptSecret("not-even-close"), null);
    assert.equal(decryptSecret("v2:aa:bb:cc"), null); // unknown version
  });
});

test("a ciphertext from a different key does not decrypt", () => {
  const cipher = withKey("key-one", () => encryptSecret("secret")!);
  const out = withKey("key-two", () => decryptSecret(cipher));
  assert.equal(out, null);
});
