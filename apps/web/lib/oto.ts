/**
 * One-time offer (OTO) — a single post-purchase add-on an operator can switch on.
 *
 * DELIBERATELY INERT UNTIL CONFIGURED. There is NO offer unless the server has
 * `STRIPE_PRICE_OTO_CAMPAIGN_STUDIO` set to a real Stripe one-time Price id. With
 * it unset, `otoConfig()` returns null, the /api/billing/oto routes 503, and the
 * card renders nothing — so this whole feature ships dark and can never charge a
 * customer until an operator opts in by creating the Stripe price and setting the
 * env. That env var IS the enable switch (server-side, operator-controlled) — no
 * admin toggle, no live checkout code path is modified.
 *
 * It reuses the app's existing entitlement system: an accepted OTO grants the
 * `campaign_studio` add-on, exactly what the subscription "performance" plan
 * already includes. And it is handled by its OWN isolated webhook
 * (/api/webhooks/stripe-oto, verified with STRIPE_OTO_WEBHOOK_SECRET) so it can
 * never touch — or be confused with — the subscription-billing webhook.
 *
 * Raw-REST Stripe calls, same zero-dependency pattern as lib/stripe-billing.ts.
 */
import type { Entitlement } from "./entitlements";

export interface OtoConfig {
  priceId: string;
  entitlement: Entitlement;
  name: string;
  description: string;
  /** Display-only label (the real charge is whatever the Stripe price is). */
  priceLabel: string;
}

/** The configured OTO, or null when the server hasn't set the price env — the
 *  single source of "is there an offer at all". */
export function otoConfig(): OtoConfig | null {
  const priceId = process.env.STRIPE_PRICE_OTO_CAMPAIGN_STUDIO;
  if (!priceId) return null;
  return {
    priceId,
    entitlement: "campaign_studio",
    name: "Unlock Campaign Studio",
    description:
      "Add the full Campaign Studio to this workspace — AI ad creative, copy and campaign tools — as a one-time purchase, no subscription.",
    priceLabel: process.env.OTO_PRICE_LABEL || "One-time",
  };
}

export interface CreateOtoOpts {
  customerEmail: string;
  workspaceId: string;
  successUrl: string;
  cancelUrl: string;
}

/** Creates a Stripe Checkout Session (mode=payment) for the OTO — the same
 *  raw-REST shape as createCheckoutSession in stripe-billing.ts, just one-time
 *  instead of a subscription. The workspace id (client_reference_id) and the
 *  entitlement (metadata) travel on both the session and the PaymentIntent so
 *  the isolated OTO webhook can grant the right add-on to the right workspace. */
export async function createOtoCheckoutSession(opts: CreateOtoOpts): Promise<{ url: string } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  const cfg = otoConfig();
  if (!key) return { error: "Billing isn't configured on this server yet." };
  if (!cfg) return { error: "No one-time offer is configured." };

  const params = new URLSearchParams({
    mode: "payment",
    // Card only: async methods (ACH/SEPA/BACS) can fire a "complete" checkout
    // session while still unpaid, which the webhook must never treat as paid.
    "payment_method_types[0]": "card",
    "line_items[0][price]": cfg.priceId,
    "line_items[0][quantity]": "1",
    customer_email: opts.customerEmail,
    client_reference_id: opts.workspaceId,
    "metadata[otoEntitlement]": cfg.entitlement,
    "metadata[workspaceId]": opts.workspaceId,
    "payment_intent_data[metadata][otoEntitlement]": cfg.entitlement,
    "payment_intent_data[metadata][workspaceId]": opts.workspaceId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });

  let res: Response;
  try {
    res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { url?: string };
  if (!data.url) return { error: "Stripe did not return a checkout URL." };
  return { url: data.url };
}

/** The workspaceId/otoEntitlement pair recorded in a Charge's metadata —
 *  createOtoCheckoutSession above sets it on payment_intent_data.metadata,
 *  which Stripe copies onto the resulting Charge, so a charge.refunded event
 *  carries this directly on its own object. A Dispute (charge.dispute.created)
 *  does NOT inherit it — only the disputed charge's id — so the OTO webhook
 *  fetches the charge to read the same pair. */
export async function getChargeOtoMetadata(chargeId: string): Promise<{ workspaceId: string | null; otoEntitlement: string | null } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Billing isn't configured on this server yet." };

  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/charges/${encodeURIComponent(chargeId)}`, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    return { error: "Could not reach Stripe. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return { error: body?.error?.message ?? `Stripe error (${res.status}).` };
  }
  const data = await res.json() as { metadata?: Record<string, unknown> };
  const meta = data.metadata ?? {};
  return {
    workspaceId: typeof meta.workspaceId === "string" ? meta.workspaceId : null,
    otoEntitlement: typeof meta.otoEntitlement === "string" ? meta.otoEntitlement : null,
  };
}
