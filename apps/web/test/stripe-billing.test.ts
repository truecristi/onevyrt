import test from "node:test";
import assert from "node:assert/strict";
import { billingConfigured, priceIdForPlan, planForPriceId, publishableKey, createCheckoutSession, createIncompleteSubscription, applyReferralDiscount } from "../lib/stripe-billing";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return fn(); }
  finally { for (const k of Object.keys(prev)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
}

test("billingConfigured: false with no STRIPE_SECRET_KEY, true once set", () => {
  withEnv({ STRIPE_SECRET_KEY: undefined }, () => assert.equal(billingConfigured(), false));
  withEnv({ STRIPE_SECRET_KEY: "sk_test_x" }, () => assert.equal(billingConfigured(), true));
});

test("priceIdForPlan: reads the plan-specific env var, null when unset", () => {
  withEnv({ STRIPE_PRICE_PRO: undefined }, () => assert.equal(priceIdForPlan("pro"), null));
  withEnv({ STRIPE_PRICE_PRO: "price_123" }, () => assert.equal(priceIdForPlan("pro"), "price_123"));
  withEnv({ STRIPE_PRICE_BUSINESS: "price_456" }, () => assert.equal(priceIdForPlan("business"), "price_456"));
});

test("createCheckoutSession: fails gracefully (not a thrown exception) when billing isn't configured", async () => {
  await withEnv({ STRIPE_SECRET_KEY: undefined }, async () => {
    const result = await createCheckoutSession({ priceId: "price_x", customerEmail: "a@example.com", workspaceId: "ws1", plan: "pro", successUrl: "https://x/success", cancelUrl: "https://x/cancel" });
    assert.ok("error" in result);
    assert.match((result as { error: string }).error, /isn't configured/i);
  });
});

test("planForPriceId: reverses priceIdForPlan, null for an unrecognized price", () => {
  withEnv({ STRIPE_PRICE_PRO: "price_pro1", STRIPE_PRICE_BUSINESS: "price_biz1" }, () => {
    assert.equal(planForPriceId("price_pro1"), "pro");
    assert.equal(planForPriceId("price_biz1"), "business");
    assert.equal(planForPriceId("price_unknown"), null);
  });
});

test("publishableKey: reads STRIPE_PUBLISHABLE_KEY, null when unset", () => {
  withEnv({ STRIPE_PUBLISHABLE_KEY: undefined }, () => assert.equal(publishableKey(), null));
  withEnv({ STRIPE_PUBLISHABLE_KEY: "pk_test_x" }, () => assert.equal(publishableKey(), "pk_test_x"));
});

test("createIncompleteSubscription: fails gracefully when billing isn't configured", async () => {
  await withEnv({ STRIPE_SECRET_KEY: undefined }, async () => {
    const result = await createIncompleteSubscription("cus_x", "price_x", "pro", "ws1");
    assert.ok("error" in result);
    assert.match((result as { error: string }).error, /isn't configured/i);
  });
});

test("applyReferralDiscount: fails gracefully when billing isn't configured", async () => {
  await withEnv({ STRIPE_SECRET_KEY: undefined }, async () => {
    const result = await applyReferralDiscount("sub_x", 1470, "usd");
    assert.ok("error" in result);
    assert.match((result as { error: string }).error, /isn't configured/i);
  });
});
