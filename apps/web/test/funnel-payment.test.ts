import test from "node:test";
import assert from "node:assert/strict";
import { isPayable, sanitizePaymentConfig } from "../lib/studio/qualification-config";
import { resolveFunnelPayment, PLATFORM_FEE_PERCENT } from "../lib/acquisition/funnel-payment";

test("isPayable: only a complete, positive, well-formed config is payable", () => {
  assert.equal(isPayable({ enabled: true, priceCents: 5000, currency: "usd" }), true);
  assert.equal(isPayable(undefined), false);
  assert.equal(isPayable({ enabled: false, priceCents: 5000, currency: "usd" }), false, "off");
  assert.equal(isPayable({ enabled: true, priceCents: 0, currency: "usd" }), false, "free is not payable");
  assert.equal(isPayable({ enabled: true, priceCents: -100, currency: "usd" }), false, "negative");
  assert.equal(isPayable({ enabled: true, priceCents: 12.5 as number, currency: "usd" }), false, "must be whole cents");
  assert.equal(isPayable({ enabled: true, priceCents: 5000, currency: "US$" }), false, "currency must be 3 letters");
});

test("sanitizePaymentConfig: clamps price, normalises currency, caps text", () => {
  const c = sanitizePaymentConfig({ enabled: true, priceCents: 49.9, currency: "USD", label: "  Reserve  ", description: "x".repeat(400) });
  assert.deepEqual({ enabled: c!.enabled, priceCents: c!.priceCents, currency: c!.currency, label: c!.label }, { enabled: true, priceCents: 49, currency: "usd", label: "Reserve" });
  assert.equal(c!.description!.length, 300, "description capped at 300");

  const bad = sanitizePaymentConfig({ enabled: "yes", priceCents: -10, currency: "€" });
  assert.deepEqual(bad, { enabled: false, priceCents: 0, currency: "usd" }, "non-bool enabled → false, bad price → 0, bad currency → usd");

  assert.equal(sanitizePaymentConfig(null), undefined);
  assert.equal(sanitizePaymentConfig("nope"), undefined);
});

test("resolveFunnelPayment: server config is authoritative and gates on platform + account", () => {
  const cfg = { enabled: true, priceCents: 5000, currency: "usd", label: "Deposit", description: "50% deposit" };

  // Fully set up → an ok plan carrying the config's own amount/currency.
  const ok = resolveFunnelPayment(cfg, { platformConfigured: true, connectAccountId: "acct_123", accountReady: true });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.amountCents, 5000, "amount comes from config, never a caller");
    assert.equal(ok.currency, "usd");
    assert.equal(ok.description, "50% deposit");
    assert.equal(ok.feePercent, PLATFORM_FEE_PERCENT);
  }

  // Each failure reason is distinct and honest.
  assert.deepEqual(resolveFunnelPayment(undefined, { platformConfigured: true, connectAccountId: "acct_1", accountReady: true }), { ok: false, reason: "not_enabled" });
  assert.deepEqual(resolveFunnelPayment({ enabled: false, priceCents: 5000, currency: "usd" }, { platformConfigured: true, connectAccountId: "acct_1", accountReady: true }), { ok: false, reason: "not_enabled" });
  assert.deepEqual(resolveFunnelPayment(cfg, { platformConfigured: false, connectAccountId: "acct_1", accountReady: true }), { ok: false, reason: "not_configured" });
  assert.deepEqual(resolveFunnelPayment(cfg, { platformConfigured: true, connectAccountId: null, accountReady: true }), { ok: false, reason: "no_account" });
  // Connect onboarding started (id present) but Stripe hasn't cleared the account yet.
  assert.deepEqual(resolveFunnelPayment(cfg, { platformConfigured: true, connectAccountId: "acct_1", accountReady: false }), { ok: false, reason: "account_not_ready" });
});

test("resolveFunnelPayment: description falls back to label, then a generic word", () => {
  const base = { enabled: true, priceCents: 1000, currency: "usd" };
  const ctx = { platformConfigured: true, connectAccountId: "acct_1", accountReady: true };
  const labelled = resolveFunnelPayment({ ...base, label: "Reserve your spot" }, ctx);
  assert.equal(labelled.ok && labelled.description, "Reserve your spot");
  const bare = resolveFunnelPayment(base, ctx);
  assert.equal(bare.ok && bare.description, "Payment");
});
