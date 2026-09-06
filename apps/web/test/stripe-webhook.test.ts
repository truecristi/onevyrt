import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyStripeSignature, planEffectFromEvent } from "../lib/stripe-webhook";

const SECRET = "whsec_test_secret";

function sign(payload: string, t: number, secret = SECRET): string {
  const sig = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

test("verifyStripeSignature: accepts a correctly signed, fresh payload", () => {
  const payload = JSON.stringify({ type: "checkout.session.completed" });
  const now = Date.now();
  const header = sign(payload, Math.floor(now / 1000));
  const r = verifyStripeSignature(payload, header, SECRET, 300, now);
  assert.equal(r.ok, true);
});

test("verifyStripeSignature: rejects a tampered payload", () => {
  const payload = JSON.stringify({ type: "checkout.session.completed", amount: 100 });
  const now = Date.now();
  const header = sign(payload, Math.floor(now / 1000));
  const tampered = JSON.stringify({ type: "checkout.session.completed", amount: 999999 });
  const r = verifyStripeSignature(tampered, header, SECRET, 300, now);
  assert.equal(r.ok, false);
});

test("verifyStripeSignature: rejects the wrong secret", () => {
  const payload = JSON.stringify({ type: "ping" });
  const now = Date.now();
  const header = sign(payload, Math.floor(now / 1000));
  const r = verifyStripeSignature(payload, header, "whsec_wrong_secret", 300, now);
  assert.equal(r.ok, false);
});

test("verifyStripeSignature: accepts either secret during a rotation overlap", () => {
  const payload = JSON.stringify({ type: "ping" });
  const now = Date.now();
  const t = Math.floor(now / 1000);
  const oldS = "whsec_old_secret";
  const newS = "whsec_new_secret";
  const secrets = [oldS, newS];
  // Signed by the old secret while the new one is already listed first.
  assert.equal(verifyStripeSignature(payload, sign(payload, t, oldS), secrets, 300, now).ok, true);
  // Signed by the new secret while the old one is still listed.
  assert.equal(verifyStripeSignature(payload, sign(payload, t, newS), secrets, 300, now).ok, true);
  // A secret in neither list still fails.
  assert.equal(verifyStripeSignature(payload, sign(payload, t, "whsec_other"), secrets, 300, now).ok, false);
});

test("verifyStripeSignature: an empty secret list never verifies", () => {
  const payload = JSON.stringify({ type: "ping" });
  const now = Date.now();
  const header = sign(payload, Math.floor(now / 1000));
  const r = verifyStripeSignature(payload, header, [], 300, now);
  assert.equal(r.ok, false);
});

test("verifyStripeSignature: rejects an expired timestamp (replay protection)", () => {
  const payload = JSON.stringify({ type: "ping" });
  const now = Date.now();
  const staleT = Math.floor(now / 1000) - 600; // 10 minutes old, default tolerance is 300s
  const header = sign(payload, staleT);
  const r = verifyStripeSignature(payload, header, SECRET, 300, now);
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /tolerance/);
});

test("verifyStripeSignature: rejects a missing signature header", () => {
  const r = verifyStripeSignature("{}", null, SECRET);
  assert.equal(r.ok, false);
});

test("verifyStripeSignature: rejects a malformed header", () => {
  const r = verifyStripeSignature("{}", "garbage-not-a-real-header", SECRET);
  assert.equal(r.ok, false);
});

// ── planEffectFromEvent: the event → plan-change decision ───────────────────

test("checkout.session.completed → sets the purchased plan and carries the customer id", () => {
  const eff = planEffectFromEvent({
    type: "checkout.session.completed",
    data: { object: { client_reference_id: "ws_1", customer: "cus_9", metadata: { plan: "pro" } } },
  });
  assert.deepEqual(eff, { wsId: "ws_1", plan: "pro", isPaid: true, auditDetail: "pro", customerId: "cus_9", source: "checkout" });
});

test("checkout without a plan (or an unknown plan) is not actionable", () => {
  assert.equal(planEffectFromEvent({ type: "checkout.session.completed", data: { object: { client_reference_id: "ws_1" } } }), null);
  assert.equal(planEffectFromEvent({ type: "checkout.session.completed", data: { object: { client_reference_id: "ws_1", metadata: { plan: "enterprise" } } } }), null, "unknown plan rejected");
  assert.equal(planEffectFromEvent({ type: "checkout.session.completed", data: { object: { metadata: { plan: "pro" } } } }), null, "missing workspace rejected");
});

test("subscription active/trialing → sets plan as paid and echoes the status", () => {
  for (const status of ["active", "trialing"]) {
    const eff = planEffectFromEvent({
      type: "customer.subscription.updated",
      data: { object: { status, metadata: { workspaceId: "ws_2", plan: "business" } } },
    });
    assert.deepEqual(eff, { wsId: "ws_2", plan: "business", isPaid: true, auditDetail: "business", status, source: "subscription" });
  }
});

test("subscription created event is handled the same as updated", () => {
  const eff = planEffectFromEvent({
    type: "customer.subscription.created",
    data: { object: { status: "active", metadata: { workspaceId: "ws_2", plan: "pro" } } },
  });
  assert.equal(eff?.isPaid, true);
  assert.equal(eff?.plan, "pro");
});

test("an incomplete/pending subscription is NOT actionable — no premature access grant", () => {
  const eff = planEffectFromEvent({
    type: "customer.subscription.updated",
    data: { object: { status: "incomplete", metadata: { workspaceId: "ws_2", plan: "pro" } } },
  });
  assert.equal(eff, null);
});

test("a lapsed subscription reverts to free with the status in the audit detail", () => {
  for (const status of ["canceled", "unpaid", "incomplete_expired"]) {
    const eff = planEffectFromEvent({
      type: "customer.subscription.updated",
      data: { object: { status, metadata: { workspaceId: "ws_3", plan: "pro" } } },
    });
    assert.deepEqual(eff, { wsId: "ws_3", plan: "free", isPaid: false, auditDetail: `free (subscription ${status})`, status, source: "subscription" });
  }
});

test("past_due does NOT revoke access (Smart Retries window)", () => {
  const eff = planEffectFromEvent({
    type: "customer.subscription.updated",
    data: { object: { status: "past_due", metadata: { workspaceId: "ws_3", plan: "pro" } } },
  });
  assert.equal(eff, null, "past_due is neither an activation nor a lapse");
});

test("customer.subscription.deleted always drops to free", () => {
  const eff = planEffectFromEvent({
    type: "customer.subscription.deleted",
    data: { object: { metadata: { workspaceId: "ws_4" } } },
  });
  assert.deepEqual(eff, { wsId: "ws_4", plan: "free", isPaid: false, auditDetail: "free (subscription deleted)", status: "deleted", source: "subscription" });
});

test("events without a workspace id, or of unknown type, are ignored", () => {
  assert.equal(planEffectFromEvent({ type: "customer.subscription.deleted", data: { object: {} } }), null);
  assert.equal(planEffectFromEvent({ type: "customer.subscription.updated", data: { object: { status: "active", metadata: { plan: "pro" } } } }), null, "no workspace id");
  assert.equal(planEffectFromEvent({ type: "invoice.paid", data: { object: {} } }), null, "unhandled type");
  assert.equal(planEffectFromEvent({}), null, "empty event");
});

// ── planEffectFromEvent: charge.refunded / charge.dispute.created ───────────
// Neither carries a workspace id in its own payload — the caller (the
// billing webhook route) resolves one via the charge's Stripe customer id
// and passes it in as the second argument.

test("a fully refunded charge, with a resolved workspace, reverts to free", () => {
  const eff = planEffectFromEvent({ type: "charge.refunded", data: { object: { refunded: true } } }, "ws_5");
  assert.deepEqual(eff, { wsId: "ws_5", plan: "free", isPaid: false, auditDetail: "free (charge refunded)", status: "refunded", source: "subscription" });
});

test("a PARTIAL refund (refunded: false) is not actionable — not evidence of a lapsed subscription", () => {
  const eff = planEffectFromEvent({ type: "charge.refunded", data: { object: { refunded: false } } }, "ws_5");
  assert.equal(eff, null);
});

test("a disputed charge, with a resolved workspace, reverts to free", () => {
  const eff = planEffectFromEvent({ type: "charge.dispute.created", data: { object: {} } }, "ws_6");
  assert.deepEqual(eff, { wsId: "ws_6", plan: "free", isPaid: false, auditDetail: "free (charge disputed)", status: "disputed", source: "subscription" });
});

test("refund/dispute events are not actionable when the caller couldn't resolve a workspace", () => {
  assert.equal(planEffectFromEvent({ type: "charge.refunded", data: { object: { refunded: true } } }, null), null);
  assert.equal(planEffectFromEvent({ type: "charge.refunded", data: { object: { refunded: true } } }), null, "omitted entirely, same as null");
  assert.equal(planEffectFromEvent({ type: "charge.dispute.created", data: { object: {} } }, undefined), null);
});
