/**
 * Stripe webhook for the ONE-TIME OFFER only — deliberately SEPARATE from the
 * subscription-billing webhook (/api/webhooks/stripe-billing) so it can never
 * touch, delay, or be confused with subscription processing. It is a distinct
 * Stripe webhook endpoint with its OWN signing secret (STRIPE_OTO_WEBHOOK_SECRET);
 * point a dedicated Stripe endpoint at this URL when enabling the OTO,
 * subscribed to checkout.session.completed, charge.refunded, AND
 * charge.dispute.created — the refund/dispute handlers below never fire if
 * the Stripe Dashboard endpoint isn't also subscribed to those two. Until
 * the secret is set, this route 503s and does nothing.
 *
 * On a completed, PAID OTO checkout it grants the add-on entitlement to the
 * workspace. grantEntitlement is idempotent, so a Stripe redelivery re-granting
 * the same entitlement is a harmless no-op — no separate dedupe table needed.
 *
 * It also listens for charge.refunded and charge.dispute.created on that same
 * charge, to revoke the entitlement again — a refund doesn't undo a
 * grantEntitlement call by itself, so without this a refunded/disputed OTO
 * buyer would keep the add-on forever. revokeEntitlement is equally
 * idempotent (a plain status='canceled' UPDATE), so the same no-dedupe-table
 * reasoning applies to these events too.
 */
import { verifyStripeSignature } from "../../../../lib/stripe-webhook";
import { grantEntitlement, revokeEntitlement, type Entitlement } from "../../../../lib/entitlements";
import { getChargeOtoMetadata } from "../../../../lib/oto";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// The only entitlements an OTO session is ever allowed to grant — a guard so a
// tampered/unexpected metadata value can't grant something arbitrary.
const GRANTABLE: ReadonlySet<string> = new Set<Entitlement>(["campaign_studio"]);

export const POST = withRouteLogging("api/webhooks/stripe-oto:POST", async (req: Request): Promise<Response> => {
  const secrets = (process.env.STRIPE_OTO_WEBHOOK_SECRET ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (secrets.length === 0) return json({ error: "STRIPE_OTO_WEBHOOK_SECRET is not configured on this server." }, 503);

  const rawBody = await req.text();
  const result = verifyStripeSignature(rawBody, req.headers.get("stripe-signature"), secrets);
  if (!result.ok) return json({ error: result.reason ?? "Invalid signature." }, 400);

  let event: { type?: unknown; data?: { object?: Record<string, unknown> } };
  try { event = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON body." }, 400); }

  if (event.type === "checkout.session.completed") {
    const obj = event.data?.object ?? {};
    // Require the payment to have actually CLEARED — not merely a "complete"
    // session. With an async payment method (ACH/SEPA/BACS) Stripe fires
    // checkout.session.completed with status:"complete" but payment_status:
    // "unpaid" the moment the customer submits (unconfirmed) bank details;
    // treating that as paid would grant the add-on for free with no auto-revoke
    // if the debit later bounces. The checkout is also restricted to cards
    // (see lib/oto.ts) so this path is card-only in practice.
    const paid = obj.payment_status === "paid";
    const meta = (obj.metadata ?? {}) as Record<string, unknown>;
    const wsId = typeof obj.client_reference_id === "string" && obj.client_reference_id
      ? obj.client_reference_id
      : (typeof meta.workspaceId === "string" ? meta.workspaceId : null);
    const ent = typeof meta.otoEntitlement === "string" ? meta.otoEntitlement : null;
    // Only OUR one-time-offer sessions (they carry otoEntitlement metadata),
    // only when the payment actually cleared, only a whitelisted entitlement,
    // and only with a real workspace to grant it to.
    if (paid && wsId && ent && GRANTABLE.has(ent)) {
      await grantEntitlement(wsId, ent as Entitlement);
    }
  }

  // A charge on an OTO PaymentIntent came back (in full) or is being
  // disputed — Stripe doesn't undo the grant on its own, so revoke it here.
  // Stripe copies a PaymentIntent's metadata onto the Charge(s) it creates,
  // and createOtoCheckoutSession (lib/oto.ts) sets payment_intent_data.metadata
  // specifically so this object carries the same workspaceId/otoEntitlement
  // pair the checkout.session.completed handler above reads.
  if (event.type === "charge.refunded") {
    const obj = event.data?.object ?? {};
    // charge.refunded also fires for PARTIAL refunds; only a charge refunded
    // in FULL is treated as "give the add-on back" — same reasoning as the
    // subscription-billing webhook (see lib/stripe-webhook.ts).
    if (obj.refunded === true) {
      const meta = (obj.metadata ?? {}) as Record<string, unknown>;
      const wsId = typeof meta.workspaceId === "string" ? meta.workspaceId : null;
      const ent = typeof meta.otoEntitlement === "string" ? meta.otoEntitlement : null;
      if (wsId && ent && GRANTABLE.has(ent)) {
        await revokeEntitlement(wsId, ent as Entitlement);
      }
    }
  }

  if (event.type === "charge.dispute.created") {
    const obj = event.data?.object ?? {};
    // Unlike a Charge, a Dispute doesn't inherit the underlying charge's
    // metadata — fetch that charge to read the same workspaceId/otoEntitlement
    // pair. A Stripe-side failure here throws (route 500s, Stripe redelivers)
    // rather than silently never revoking — same reasoning as the
    // subscription-billing webhook's dispute handling.
    const chargeId = typeof obj.charge === "string" ? obj.charge : null;
    if (chargeId) {
      const meta = await getChargeOtoMetadata(chargeId);
      if ("error" in meta) throw new Error(`Could not resolve disputed charge's metadata: ${meta.error}`);
      if (meta.workspaceId && meta.otoEntitlement && GRANTABLE.has(meta.otoEntitlement)) {
        await revokeEntitlement(meta.workspaceId, meta.otoEntitlement as Entitlement);
      }
    }
  }

  return json({ received: true });
});
