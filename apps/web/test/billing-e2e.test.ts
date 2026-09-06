import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as stripeBilling from "../lib/stripe-billing";
import * as workspaces from "../lib/workspaces";
import { POST as webhookPOST } from "../app/api/webhooks/stripe-billing/route";
import { uid, purgeWorkspacesByNamePrefix } from "./helpers/pg";

/**
 * Real end-to-end proof of the billing flow, against Stripe's real test-mode
 * API — not a mock. It creates a real test Product/Price, a real Customer, a
 * real incomplete Subscription (exactly what /api/billing/subscribe does),
 * confirms the PaymentIntent with Stripe's designated test card token
 * (pm_card_visa — not anyone's real card, this can never move real money),
 * then feeds the real resulting subscription object through the actual
 * deployed webhook handler and asserts a real workspace's plan flips.
 *
 * Requires STRIPE_TEST_SECRET_KEY (a sk_test_... key) to run at all — skips
 * entirely otherwise, since it makes real network calls to Stripe and has
 * no meaningful way to run in an environment without test credentials.
 */
const TEST_KEY = process.env.STRIPE_TEST_SECRET_KEY;

async function stripe(key: string, method: string, path: string, params?: Record<string, string>): Promise<Record<string, unknown>> {
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const url = method === "GET" && params ? `https://api.stripe.com/v1/${path}?${new URLSearchParams(params).toString()}` : `https://api.stripe.com/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : body,
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(`Stripe ${method} ${path} failed: ${JSON.stringify(data)}`);
  return data;
}

function signWebhookBody(rawBody: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

test("billing e2e: subscribe -> pay with Stripe's test card -> webhook flips the real workspace plan", { skip: !TEST_KEY }, async () => {
  const prefix = uid("billing-e2e");
  const prevKey = process.env.STRIPE_SECRET_KEY;
  const prevWebhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = TEST_KEY;
  const webhookSecret = "whsec_test_billing_e2e";
  process.env.STRIPE_BILLING_WEBHOOK_SECRET = webhookSecret;

  let productId: string | undefined;
  let customerId: string | undefined;
  let subscriptionId: string | undefined;
  try {
    // 1. Real test-mode product + price, created fresh so this test never
    // depends on fixtures existing in whoever's Stripe account runs it.
    const product = await stripe(TEST_KEY!, "POST", "products", { name: `billing-e2e-test-${prefix}` });
    productId = product.id as string;
    const price = await stripe(TEST_KEY!, "POST", "prices", { product: productId, currency: "gbp", unit_amount: "7900", "recurring[interval]": "month" });
    const priceId = price.id as string;

    // 2. A real workspace to prove the plan flip actually persists.
    const owner = { id: `${prefix}-owner` };
    const ws = await workspaces.createWorkspace(owner.id, `${prefix} Billing E2E Test WS`);

    // 3. The exact same functions /api/billing/subscribe calls.
    const customer = await stripeBilling.getOrCreateCustomer(undefined, "billing-e2e-test@example.com", ws.id);
    assert.ok(!("error" in customer), `getOrCreateCustomer failed: ${JSON.stringify(customer)}`);
    customerId = (customer as { id: string }).id;

    const sub = await stripeBilling.createIncompleteSubscription(customerId, priceId, "pro", ws.id);
    assert.ok(!("error" in sub), `createIncompleteSubscription failed: ${JSON.stringify(sub)}`);
    const { subscriptionId: subId, clientSecret } = sub as { subscriptionId: string; clientSecret: string };
    subscriptionId = subId;

    // 4. Confirm the PaymentIntent with Stripe's designated test card
    // token — this is Stripe's own fixture for exactly this purpose, not
    // financial data belonging to anyone. Guaranteed to succeed in test mode.
    const piId = clientSecret.split("_secret_")[0];
    const confirmed = await stripe(TEST_KEY!, "POST", `payment_intents/${piId}/confirm`, { payment_method: "pm_card_visa" });
    assert.equal(confirmed.status, "succeeded");

    // 5. Poll until Stripe has actually flipped the subscription to active
    // (usually near-instant, but it's an async transition on their side).
    let subscription: Record<string, unknown> | null = null;
    for (let i = 0; i < 10; i++) {
      const s = await stripe(TEST_KEY!, "GET", `subscriptions/${subscriptionId}`);
      if (s.status === "active") { subscription = s; break; }
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert.ok(subscription, "subscription never reached active status");
    assert.equal(subscription!.status, "active");

    // 6. Feed the REAL subscription object through the REAL deployed
    // webhook handler, signed the same way Stripe signs real deliveries.
    const event = { id: `evt_${prefix}`, type: "customer.subscription.updated", data: { object: subscription } };
    const rawBody = JSON.stringify(event);
    const signature = signWebhookBody(rawBody, webhookSecret);
    const req = new Request("https://onevyrt.example/api/webhooks/stripe-billing", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });
    const res = await webhookPOST(req);
    assert.equal(res.status, 200);
    const resBody = await res.json();
    assert.equal(resBody.received, true);

    // 7. The actual proof: the workspace's plan really changed.
    const updated = await workspaces.getWorkspace(ws.id);
    assert.equal(updated?.plan, "pro");
  } finally {
    // Clean up the real Stripe objects this test created.
    if (subscriptionId) await stripe(TEST_KEY!, "DELETE", `subscriptions/${subscriptionId}`).catch(() => {});
    if (customerId) await stripe(TEST_KEY!, "DELETE", `customers/${customerId}`).catch(() => {});
    if (productId) await stripe(TEST_KEY!, "POST", `products/${productId}`, { active: "false" }).catch(() => {});
    if (prevKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = prevKey;
    if (prevWebhookSecret === undefined) delete process.env.STRIPE_BILLING_WEBHOOK_SECRET; else process.env.STRIPE_BILLING_WEBHOOK_SECRET = prevWebhookSecret;
    await purgeWorkspacesByNamePrefix(prefix);
  }
});
