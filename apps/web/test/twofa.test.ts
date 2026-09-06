import test from "node:test";
import assert from "node:assert/strict";
import { generateTotpSecret, currentTotpCode, verifyTotp, totpUri, generateBackupCodes, hashBackupCode } from "../lib/twofa";

test("verifyTotp: accepts the current code for a freshly generated secret", () => {
  const secret = generateTotpSecret();
  const code = currentTotpCode(secret);
  assert.equal(verifyTotp(secret, code), true);
});

test("verifyTotp: rejects a wrong code", () => {
  const secret = generateTotpSecret();
  const code = currentTotpCode(secret);
  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal(verifyTotp(secret, wrong), false);
});

test("verifyTotp: rejects malformed input (not 6 digits)", () => {
  const secret = generateTotpSecret();
  assert.equal(verifyTotp(secret, "12345"), false);
  assert.equal(verifyTotp(secret, "abcdef"), false);
  assert.equal(verifyTotp(secret, ""), false);
});

test("verifyTotp: tolerates one 30s time step of drift either direction", () => {
  const secret = generateTotpSecret();
  const now = Date.now();
  const oneStepAgo = now - 30_000;
  const oneStepAhead = now + 30_000;
  assert.equal(verifyTotp(secret, currentTotpCode(secret, oneStepAgo), now), true);
  assert.equal(verifyTotp(secret, currentTotpCode(secret, oneStepAhead), now), true);
});

test("verifyTotp: rejects a code from two time steps away", () => {
  const secret = generateTotpSecret();
  const now = Date.now();
  const twoStepsAgo = now - 60_000;
  assert.equal(verifyTotp(secret, currentTotpCode(secret, twoStepsAgo), now), false);
});

test("verifyTotp: two different secrets don't accept each other's codes", () => {
  const a = generateTotpSecret();
  const b = generateTotpSecret();
  assert.notEqual(a, b);
  assert.equal(verifyTotp(b, currentTotpCode(a)), false);
});

test("totpUri: embeds the secret and account email in a standard otpauth URI", () => {
  const secret = generateTotpSecret();
  const uri = totpUri(secret, "person@example.com");
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.match(uri, new RegExp(`secret=${secret}`));
  assert.match(uri, /person%40example\.com/);
});

test("generateBackupCodes: returns the requested count of distinct codes", () => {
  const codes = generateBackupCodes(8);
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8, "codes should be distinct");
});

test("hashBackupCode: same code+pepper hashes identically, different code hashes differently", () => {
  const pepper = "test-pepper";
  const [a, b] = generateBackupCodes(2);
  assert.ok(a && b);
  assert.equal(hashBackupCode(a, pepper), hashBackupCode(a, pepper));
  assert.notEqual(hashBackupCode(a, pepper), hashBackupCode(b, pepper));
});

test("hashBackupCode: is case-insensitive (matches how a user might retype it)", () => {
  const pepper = "test-pepper";
  const [code] = generateBackupCodes(1);
  assert.ok(code);
  assert.equal(hashBackupCode(code, pepper), hashBackupCode(code.toLowerCase(), pepper));
});
