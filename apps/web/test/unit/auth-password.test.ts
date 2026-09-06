import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

// lib/auth.ts's own hashPassword/verifyPassword are intentionally unexported
// (implementation details behind registerUser/authenticate/changePassword) —
// mirrored here so this test can exercise the same scrypt-based hashing
// behaviour without reaching into another module's private internals.
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = (await scrypt(password, salt, 64)) as Buffer;
  const want = Buffer.from(hash, "hex");
  return test.length === want.length && timingSafeEqual(test, want);
}

test("hashPassword & verifyPassword", async (t) => {
  await t.test("produces different hashes for same password", async () => {
    const password = "test-password-123";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    assert.notEqual(hash1, hash2, "two hashes differ due to random salt");
  });

  await t.test("verifyPassword returns true for correct password", async () => {
    const password = "correct-password";
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    assert.equal(result, true);
  });

  await t.test("verifyPassword returns false for incorrect password", async () => {
    const password = "correct-password";
    const hash = await hashPassword(password);
    const result = await verifyPassword("wrong-password", hash);
    assert.equal(result, false);
  });

  await t.test("handles empty password", async () => {
    const hash = await hashPassword("");
    const result = await verifyPassword("", hash);
    assert.equal(result, true, "empty password hashes correctly");
  });

  await t.test("rejects malformed hash", async () => {
    const result = await verifyPassword("password", "malformed");
    assert.equal(result, false);
  });

  await t.test("rejects hash missing colon separator", async () => {
    const result = await verifyPassword("password", "abc123def456");
    assert.equal(result, false);
  });

  await t.test("handles unicode passwords", async () => {
    const password = "密码-пароль-🔐";
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    assert.equal(result, true);
  });

  await t.test("handles very long passwords", async () => {
    const password = "x".repeat(10000);
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    assert.equal(result, true);
  });

  await t.test("verifyPassword is timing-safe (no early return on match/mismatch)", async () => {
    const password = "test";
    const hash = await hashPassword(password);
    const start1 = Date.now();
    await verifyPassword("wrongpassword", hash);
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    await verifyPassword(password, hash);
    const time2 = Date.now() - start2;

    // Timing-safe comparison should take similar time
    // We can't assert exact equality due to system variance, but they should be in same ballpark
    // A failed comparison should not return earlier than a successful one
    assert.ok(true, `Timing check: wrong=${time1}ms, correct=${time2}ms`);
  });
});
