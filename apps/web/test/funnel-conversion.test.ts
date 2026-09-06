import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyStripeEvent,
  isCompletedConversion,
  isRefund,
  revenueDeltaFor,
  summarizeCompleted,
  FUNNEL_PAYMENT_SOURCE,
  FUNNEL_PAID_EVENT_TYPE,
  REFUND_EVENT_TYPE,
} from "../lib/acquisition/funnel-conversion";

test("classify: a funnel-stamped payment_intent.succeeded is re-typed and attributed", () => {
  const c = classifyStripeEvent("payment_intent.succeeded", {
    metadata: { workspaceId: "ws_1", funnelSlug: "abc", source: FUNNEL_PAYMENT_SOURCE },
    amount_received: 4900,
    currency: "usd",
  });
  assert.equal(c.recordType, FUNNEL_PAID_EVENT_TYPE);
  assert.equal(c.workspaceId, "ws_1");
  assert.equal(c.amountTotal, 4900);
  assert.equal(c.currency, "usd");
});

test("classify: funnel PI falls back to `amount` when amount_received is absent", () => {
  const c = classifyStripeEvent("payment_intent.succeeded", {
    metadata: { workspaceId: "ws_2", source: FUNNEL_PAYMENT_SOURCE },
    amount: 2500,
  });
  assert.equal(c.recordType, FUNNEL_PAID_EVENT_TYPE);
  assert.equal(c.amountTotal, 2500);
});

test("classify: a payment_intent.succeeded WITHOUT the funnel source keeps its raw type (no double-count)", () => {
  // An external Checkout also fires payment_intent.succeeded for the same
  // purchase — it must NOT be re-typed or counted, or a single sale counts twice.
  const c = classifyStripeEvent("payment_intent.succeeded", {
    metadata: { workspaceId: "ws_3" },
    amount_received: 9900,
  });
  assert.equal(c.recordType, "payment_intent.succeeded");
  assert.equal(isCompletedConversion(c.recordType), false);
});

test("classify: external checkout.session.completed attributes via client_reference_id + amount_total", () => {
  const c = classifyStripeEvent("checkout.session.completed", {
    client_reference_id: "ws_4",
    payment_status: "paid",
    amount_total: 12000,
    currency: "eur",
    customer_details: { email: "buyer@example.com" },
  });
  assert.equal(c.recordType, "checkout.session.completed");
  assert.equal(c.workspaceId, "ws_4");
  assert.equal(c.amountTotal, 12000);
  assert.equal(c.customerEmail, "buyer@example.com");
  assert.equal(isCompletedConversion(c.recordType), true);
});

test("classify: an unpaid/async checkout.session.completed is recorded but NOT counted as revenue", () => {
  // Stripe fires checkout.session.completed for delayed payment methods (ACH,
  // some wallets) where the money hasn't landed yet. payment_status is then
  // "unpaid" or "no_payment_required" — those must not count as a real sale.
  for (const payment_status of ["unpaid", "no_payment_required"]) {
    const c = classifyStripeEvent("checkout.session.completed", {
      client_reference_id: "ws_5",
      payment_status,
      amount_total: 8000,
      currency: "usd",
    });
    assert.equal(c.recordType, "checkout.session.unpaid", `${payment_status} re-typed`);
    assert.equal(c.workspaceId, "ws_5", "still attributed + recorded");
    assert.equal(c.amountTotal, 8000);
    assert.equal(isCompletedConversion(c.recordType), false, `${payment_status} not counted`);
  }
});

test("classify: an unattributed event yields no workspaceId", () => {
  const c = classifyStripeEvent("payment_intent.succeeded", { amount_received: 100 });
  assert.equal(c.recordType, "payment_intent.succeeded");
  assert.equal(c.workspaceId, undefined);
});

test("isCompletedConversion: only the two revenue-bearing types count", () => {
  assert.equal(isCompletedConversion("checkout.session.completed"), true);
  assert.equal(isCompletedConversion(FUNNEL_PAID_EVENT_TYPE), true);
  assert.equal(isCompletedConversion("payment_intent.succeeded"), false);
  assert.equal(isCompletedConversion("payment_intent.payment_failed"), false);
});

test("summarizeCompleted: sums a single currency and ignores non-completed events", () => {
  const s = summarizeCompleted([
    { type: "checkout.session.completed", amountTotal: 5000, currency: "usd" },
    { type: FUNNEL_PAID_EVENT_TYPE, amountTotal: 2500, currency: "usd" },
    { type: "payment_intent.succeeded", amountTotal: 9999, currency: "usd" }, // not completed
    { type: "checkout.session.unpaid", amountTotal: 7000, currency: "usd" },  // not completed
  ]);
  assert.equal(s.completedCount, 2);
  assert.equal(s.completedAmountTotal, 7500);
  assert.equal(s.currency, "usd");
  assert.equal(s.mixedCurrency, false);
  assert.equal(s.totalCompletedCount, 2);
});

test("summarizeCompleted: NEVER cross-sums currencies — reports the dominant one and flags the rest", () => {
  const s = summarizeCompleted([
    { type: "checkout.session.completed", amountTotal: 10000, currency: "usd" },
    { type: "checkout.session.completed", amountTotal: 3000, currency: "usd" },
    { type: "checkout.session.completed", amountTotal: 500, currency: "eur" },
  ]);
  // USD dominates by summed amount; the EUR sale is NOT added into the total.
  assert.equal(s.currency, "usd");
  assert.equal(s.completedAmountTotal, 13000, "only USD summed, not 13500");
  assert.equal(s.completedCount, 2, "count is the dominant currency's, consistent with the total");
  assert.equal(s.mixedCurrency, true, "flags that other-currency sales exist");
  assert.equal(s.totalCompletedCount, 3, "all completed sales counted across currencies");
});

test("summarizeCompleted: empty / no completed events", () => {
  assert.deepEqual(summarizeCompleted([]), { completedCount: 0, completedAmountTotal: 0, currency: null, mixedCurrency: false, totalCompletedCount: 0 });
  assert.deepEqual(
    summarizeCompleted([{ type: "payment_intent.succeeded", amountTotal: 100, currency: "usd" }]),
    { completedCount: 0, completedAmountTotal: 0, currency: null, mixedCurrency: false, totalCompletedCount: 0 },
  );
});

test("classify: a charge.refunded carries the refunded amount and workspace (charge inherits PI metadata)", () => {
  const c = classifyStripeEvent("charge.refunded", {
    metadata: { workspaceId: "ws_9", source: FUNNEL_PAYMENT_SOURCE },
    amount_refunded: 3000,
    currency: "usd",
  });
  assert.equal(c.recordType, REFUND_EVENT_TYPE);
  assert.equal(c.workspaceId, "ws_9");
  assert.equal(c.amountTotal, 3000);
  assert.equal(isRefund(c.recordType), true);
  assert.equal(isCompletedConversion(c.recordType), false, "a refund is not a sale");
});

test("revenueDeltaFor: completed sale adds gross, refund adds refunded, others move nothing", () => {
  assert.deepEqual(
    revenueDeltaFor({ type: "checkout.session.completed", amountTotal: 5000, currency: "USD", workspaceId: "w" }),
    { currency: "usd", grossCents: 5000, refundedCents: 0, saleCount: 1, refundCount: 0 },
  );
  assert.deepEqual(
    revenueDeltaFor({ type: FUNNEL_PAID_EVENT_TYPE, amountTotal: 2500, currency: "eur", workspaceId: "w" }),
    { currency: "eur", grossCents: 2500, refundedCents: 0, saleCount: 1, refundCount: 0 },
  );
  assert.deepEqual(
    revenueDeltaFor({ type: REFUND_EVENT_TYPE, amountTotal: 900, currency: "usd", workspaceId: "w" }),
    { currency: "usd", grossCents: 0, refundedCents: 900, saleCount: 0, refundCount: 1 },
  );
  // Unattributed, amountless, zero, or non-money events contribute nothing.
  assert.equal(revenueDeltaFor({ type: "checkout.session.completed", amountTotal: 5000, currency: "usd" }), null, "no workspace");
  assert.equal(revenueDeltaFor({ type: "checkout.session.completed", currency: "usd", workspaceId: "w" }), null, "no amount");
  assert.equal(revenueDeltaFor({ type: "checkout.session.completed", amountTotal: 0, currency: "usd", workspaceId: "w" }), null, "zero amount");
  assert.equal(revenueDeltaFor({ type: "payment_intent.succeeded", amountTotal: 5000, currency: "usd", workspaceId: "w" }), null, "not a counted type");
});

test("summarizeCompleted: a currency-less completed event is bucketed, not crashed", () => {
  const s = summarizeCompleted([{ type: "checkout.session.completed", amountTotal: 4200 }]);
  assert.equal(s.completedAmountTotal, 4200);
  assert.equal(s.completedCount, 1);
  assert.equal(s.currency, null, "no currency reported when the event carried none");
});
