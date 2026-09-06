import test from "node:test";
import assert from "node:assert/strict";
import { connectAccountStatus, canAcceptPayments, computeApplicationFeeCents } from "../lib/stripe-connect";

test("connectAccountStatus: active only when charges AND payouts are enabled", () => {
  assert.equal(connectAccountStatus({ charges_enabled: true, payouts_enabled: true, details_submitted: true }), "active");
});

test("connectAccountStatus: restricted when the form is submitted but not fully enabled", () => {
  assert.equal(connectAccountStatus({ charges_enabled: false, payouts_enabled: false, details_submitted: true }), "restricted");
  assert.equal(connectAccountStatus({ charges_enabled: true, payouts_enabled: false, details_submitted: true }), "restricted");
});

test("connectAccountStatus: onboarding when nothing submitted, or null", () => {
  assert.equal(connectAccountStatus({ details_submitted: false }), "onboarding");
  assert.equal(connectAccountStatus(null), "onboarding");
  assert.equal(connectAccountStatus(undefined), "onboarding");
});

test("canAcceptPayments tracks charges_enabled", () => {
  assert.equal(canAcceptPayments({ charges_enabled: true }), true);
  assert.equal(canAcceptPayments({ charges_enabled: false }), false);
  assert.equal(canAcceptPayments(null), false);
});

test("computeApplicationFeeCents: standard percentage, rounded to the cent", () => {
  assert.equal(computeApplicationFeeCents(10000, 2.5), 250); // $100 @ 2.5% = $2.50
  assert.equal(computeApplicationFeeCents(999, 3), 30); // 29.97 → 30
  assert.equal(computeApplicationFeeCents(10000, 0), 0);
});

test("computeApplicationFeeCents: clamps a bad percentage into [0,100]", () => {
  assert.equal(computeApplicationFeeCents(10000, -5), 0);
  assert.equal(computeApplicationFeeCents(10000, 150), 10000); // clamped to 100%
});

test("computeApplicationFeeCents: fee never exceeds the charge and is 0 for non-positive amounts", () => {
  assert.equal(computeApplicationFeeCents(0, 10), 0);
  assert.equal(computeApplicationFeeCents(-100, 10), 0);
  assert.equal(computeApplicationFeeCents(NaN, 10), 0);
  assert.equal(computeApplicationFeeCents(500, 100), 500); // exactly the whole charge, not more
});
