/**
 * Stripe webhook signature verification, hand-rolled (no stripe SDK needed for
 * this alone). Matches Stripe's documented scheme exactly: the signed payload
 * is `${timestamp}.${rawBody}`, HMAC-SHA256'd with the endpoint's webhook
 * secret (from the user's own Stripe dashboard — never something we hold).
 * https://docs.stripe.com/webhooks#verify-manually
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Plan } from "./workspaces";

export interface VerifyResult { ok: boolean; reason?: string; }

// ── Billing-event interpretation ───────────────────────────────────────────
// The pure decision layer of the billing webhook: given a *verified* Stripe
// event, what plan change should the workspace get? Extracted from the route
// handler so the branching (which event → which plan, paid vs lapsed, where
// the workspace id and plan live in each event shape) is unit-testable without
// a database. The handler stays responsible only for idempotency + applying
// the effect (adminSetPlan / audit / dispatch).

export const VALID_PLANS: readonly Plan[] = ["free", "pro", "business", "performance"];

// Terminal, no-longer-paying subscription states. Deliberately excludes
// "past_due": Stripe's Smart Retries retry a failed card first, and revoking
// access on the first missed payment rather than the final one would be
// harsher than the retry window intends.
const LAPSED_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

/** The intended plan change distilled from one billing event, or null when the
 *  event carries nothing actionable (unknown type, missing ids, still-pending
 *  subscription, etc.). */
export interface PlanEffect {
  /** Target workspace. */
  wsId: string;
  /** The plan to set — the purchased plan when paying, "free" when lapsing. */
  plan: Plan;
  /** True when this represents an active/paying transition (drives referral
   *  qualification); false when the workspace is dropping to free. */
  isPaid: boolean;
  /** Human-readable audit detail. */
  auditDetail: string;
  /** The Stripe subscription status, when the event is a subscription event —
   *  echoed into the outbound `subscription.*` webhook payload. */
  status?: string;
  /** Present only for the hosted-checkout path, which also carries the Stripe
   *  customer id to persist onto the workspace. */
  customerId?: string;
  /** Which event shape produced this (checkout vs subscription lifecycle). */
  source: "checkout" | "subscription";
}

function str(v: unknown): string | undefined { return typeof v === "string" && v ? v : undefined; }
function validPlan(v: unknown): Plan | undefined {
  return typeof v === "string" && (VALID_PLANS as readonly string[]).includes(v) ? (v as Plan) : undefined;
}

/**
 * Map a verified Stripe billing event to the plan change it should cause.
 * Pure — no I/O, no side effects. Returns null for anything not actionable.
 */
export function planEffectFromEvent(
  event: {
    type?: unknown;
    data?: { object?: Record<string, unknown> };
  },
  // Resolved by the caller (a DB/Stripe lookup — impure, so it can't live in
  // this function) for the two charge-level event types below, which key off
  // a Stripe customer/charge rather than carrying a workspace id in their own
  // payload the way checkout/subscription events do. Unused otherwise.
  resolvedWorkspaceId?: string | null,
): PlanEffect | null {
  const type = event?.type;
  const obj = event?.data?.object ?? {};

  // Legacy hosted Checkout Session: workspace in client_reference_id, plan in
  // metadata. The embedded in-app flow doesn't produce these (see below).
  if (type === "checkout.session.completed") {
    const wsId = str(obj.client_reference_id);
    const plan = validPlan((obj.metadata as Record<string, unknown> | undefined)?.plan);
    if (!wsId || !plan) return null;
    return { wsId, plan, isPaid: true, auditDetail: plan, customerId: str(obj.customer), source: "checkout" };
  }

  // Embedded checkout: the subscription starts "incomplete" and flips to
  // "active"/"trialing" once the PaymentIntent confirms — that transition, not
  // the creation call, is the real "payment went through" signal.
  if (type === "customer.subscription.updated" || type === "customer.subscription.created") {
    const meta = obj.metadata as Record<string, unknown> | undefined;
    const wsId = str(meta?.workspaceId);
    const status = str(obj.status);
    if (!wsId) return null;
    const plan = validPlan(meta?.plan);
    if ((status === "active" || status === "trialing") && plan) {
      return { wsId, plan, isPaid: true, auditDetail: plan, status, source: "subscription" };
    }
    if (status && LAPSED_STATUSES.has(status)) {
      return { wsId, plan: "free", isPaid: false, auditDetail: `free (subscription ${status})`, status, source: "subscription" };
    }
    return null;
  }

  // Hard delete — always drop to free.
  if (type === "customer.subscription.deleted") {
    const wsId = str((obj.metadata as Record<string, unknown> | undefined)?.workspaceId);
    if (!wsId) return null;
    return { wsId, plan: "free", isPaid: false, auditDetail: "free (subscription deleted)", status: "deleted", source: "subscription" };
  }

  // Refund or chargeback on a subscription-billing charge. Refunding a charge
  // doesn't itself cancel the Stripe subscription, so without this a
  // refunded/disputed customer would keep their paid plan forever — treat it
  // the same as a lapsed subscription. Neither event carries a workspace id
  // in its own payload; the caller resolves one via the charge's Stripe
  // customer id against the workspace's stored stripe_customer_id (the same
  // lookup setWorkspaceStripeCustomer writes) and passes it as
  // resolvedWorkspaceId.
  if (type === "charge.refunded" || type === "charge.dispute.created") {
    if (!resolvedWorkspaceId) return null;
    // charge.refunded also fires for PARTIAL refunds (Stripe: "including
    // partial refunds"). Only a charge refunded in FULL is treated as a
    // lapsed subscription — `refunded` is Stripe's own "the entire amount
    // has come back" flag; a partial/proration refund isn't evidence the
    // customer stopped paying and shouldn't downgrade someone still active.
    if (type === "charge.refunded" && obj.refunded !== true) return null;
    const label = type === "charge.refunded" ? "refunded" : "disputed";
    return { wsId: resolvedWorkspaceId, plan: "free", isPaid: false, auditDetail: `free (charge ${label})`, status: label, source: "subscription" };
  }

  return null;
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  // One secret, or several — pass a comma-separated env value as an array so a
  // signing-secret ROTATION doesn't drop events: Stripe signs with the new
  // secret while the endpoint may still hold the old (or vice versa), and a
  // single-secret check rejects everything signed by the other one during the
  // overlap window. Any matching secret verifies.
  secret: string | readonly string[],
  toleranceSec = 300,
  now = Date.now(),
): VerifyResult {
  if (!signatureHeader) return { ok: false, reason: "Missing Stripe-Signature header." };
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i), kv.slice(i + 1)];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return { ok: false, reason: "Malformed Stripe-Signature header." };

  const ageSec = Math.abs(now / 1000 - Number(t));
  if (!Number.isFinite(ageSec) || ageSec > toleranceSec) return { ok: false, reason: "Timestamp outside tolerance (possible replay)." };

  const secrets = (Array.isArray(secret) ? secret : [secret]).filter(Boolean);
  if (secrets.length === 0) return { ok: false, reason: "No webhook secret configured." };
  const a = Buffer.from(v1, "hex");
  for (const s of secrets) {
    const expected = createHmac("sha256", s).update(`${t}.${rawBody}`).digest("hex");
    const b = Buffer.from(expected, "hex");
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true };
  }
  return { ok: false, reason: "Signature mismatch." };
}
