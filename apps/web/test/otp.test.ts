import test, { after } from "node:test";
import assert from "node:assert/strict";
import { startVerification, checkVerification, isVerified, generateCode, OTP_MAX_ATTEMPTS } from "../lib/acquisition/otp";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const SLUG = uid("otp-test");
after(async () => {
  await pgPool().query("DELETE FROM otp_verifications WHERE funnel_slug LIKE $1", [`${SLUG}%`]);
});

test("generateCode is always a 6-digit string", () => {
  for (let i = 0; i < 200; i++) assert.match(generateCode(), /^\d{6}$/);
});

test("start → wrong code fails, right code verifies (dev code surfaced without a provider)", async () => {
  const s = await startVerification({ funnelSlug: SLUG, channel: "email", destination: "Lead@Example.com" });
  assert.ok(s.id);
  assert.equal(s.sent, false, "no mailer in tests → not sent");
  assert.match(s.devCode ?? "", /^\d{6}$/, "dev code surfaced so the flow is testable");

  const wrong = await checkVerification(s.id, "000000" === s.devCode ? "111111" : "000000");
  assert.equal(wrong.ok, false);
  assert.equal(wrong.reason, "incorrect");

  const right = await checkVerification(s.id, s.devCode!);
  assert.equal(right.ok, true);
  // Destination is normalised (lowercased for email).
  assert.equal(await isVerified(s.id, "email", "lead@example.com"), true);
  assert.equal(await isVerified(s.id, "email", "someone-else@example.com"), false, "wrong destination isn't verified");
});

test("verifying is idempotent", async () => {
  const s = await startVerification({ funnelSlug: SLUG, channel: "email", destination: "x@example.com" });
  assert.equal((await checkVerification(s.id, s.devCode!)).ok, true);
  assert.equal((await checkVerification(s.id, s.devCode!)).ok, true, "still ok on a second check");
});

test("attempts are capped", async () => {
  const s = await startVerification({ funnelSlug: SLUG, channel: "email", destination: "cap@example.com" });
  const bad = s.devCode === "999999" ? "888888" : "999999";
  for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
    const r = await checkVerification(s.id, bad);
    assert.equal(r.ok, false);
  }
  const locked = await checkVerification(s.id, s.devCode!);
  assert.equal(locked.ok, false);
  assert.equal(locked.reason, "too_many_attempts", "the correct code is refused once attempts are spent");
});

test("expired codes are rejected", async () => {
  const s = await startVerification({ funnelSlug: SLUG, channel: "email", destination: "exp@example.com" });
  // Force expiry in the past.
  await pgPool().query("UPDATE otp_verifications SET expires_at = now() - interval '1 minute' WHERE id = $1", [s.id]);
  const r = await checkVerification(s.id, s.devCode!);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "expired");
});

test("an unknown id is not_found and not verified", async () => {
  assert.equal((await checkVerification("nope", "123456")).reason, "not_found");
  assert.equal(await isVerified("nope"), false);
});
