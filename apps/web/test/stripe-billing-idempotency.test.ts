import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { POST as webhookPOST } from "../app/api/webhooks/stripe-billing/route";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

/**
 * Regression test for the "a paid upgrade can be permanently lost" bug.
 *
 * The billing webhook used to mark an event processed BEFORE applying the
 * plan change. If adminSetPlan threw, the route 500'd, Stripe redelivered,
 * saw "already processed," returned 200 — and the customer had paid but
 * never got upgraded. The fix marks the event processed only AFTER the plan
 * change is durable, so a failed apply leaves the event un-marked and the
 * redelivery retries cleanly.
 *
 * We reproduce a guaranteed apply-failure by pointing the event at a
 * workspaceId that does not exist: adminSetPlan throws "Workspace not
 * found." The invariant we assert is that the event id is NOT recorded in
 * stripe_billing_processed_events after the 500 — i.e. a retry is still
 * possible. Requires the shared Postgres the rest of the suite uses.
 */
function signWebhookBody(rawBody: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

async function isProcessed(id: string): Promise<boolean> {
  const res = await pgPool().query("SELECT 1 FROM stripe_billing_processed_events WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

test("billing webhook: a failed plan-apply does NOT mark the event processed (retry stays possible)", async () => {
  const prevSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  const secret = "whsec_test_idempotency_ordering";
  process.env.STRIPE_BILLING_WEBHOOK_SECRET = secret;

  const eventId = `evt_${uid("idem")}`;
  // An active subscription for a workspace that does not exist -> the effect
  // is real (plan: pro), so adminSetPlan runs and throws "Workspace not found".
  const event = {
    id: eventId,
    type: "customer.subscription.updated",
    data: { object: { status: "active", metadata: { workspaceId: `ws_missing_${uid("x")}`, plan: "pro" } } },
  };
  const rawBody = JSON.stringify(event);

  try {
    const req = new Request("https://onevyrt.example/api/webhooks/stripe-billing", {
      method: "POST",
      headers: { "stripe-signature": signWebhookBody(rawBody, secret) },
      body: rawBody,
    });
    const res = await webhookPOST(req);

    // The apply failed, so the route surfaces an error (Stripe will redeliver).
    assert.equal(res.status, 500, "expected the failed plan-apply to 500 so Stripe retries");

    // The core invariant: the event must NOT be recorded as processed, or the
    // redelivery would short-circuit as a duplicate and the upgrade is lost.
    assert.equal(await isProcessed(eventId), false, "event was marked processed despite the apply failing — the upgrade would be lost on retry");
  } finally {
    await pgPool().query("DELETE FROM stripe_billing_processed_events WHERE id = $1", [eventId]).catch(() => {});
    if (prevSecret === undefined) delete process.env.STRIPE_BILLING_WEBHOOK_SECRET; else process.env.STRIPE_BILLING_WEBHOOK_SECRET = prevSecret;
  }
});
