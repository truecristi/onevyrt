/**
 * Stripe webhook for OneVYRT's OWN subscription billing — distinct from
 * /api/webhooks/stripe, which ingests a USER's own e-commerce events into
 * their tracked funnel. Verifies against STRIPE_BILLING_WEBHOOK_SECRET (a
 * separate endpoint secret from the tracking webhook, since they're
 * different Stripe webhook endpoints even if pointed at the same Stripe
 * account) and, on a completed checkout, sets the workspace's plan.
 */
import { verifyStripeSignature, planEffectFromEvent } from "../../../../lib/stripe-webhook";
import { setWorkspaceStripeCustomer, type Plan } from "../../../../lib/workspaces";
import { getChargeCustomerId } from "../../../../lib/stripe-billing";
import { syncReferralQualification, syncReferralDiscount } from "../../../../lib/referrals";
import { recordAudit } from "../../../../lib/audit-log";
import { pgPool } from "../../../../lib/db";
import { withRouteLogging } from "../../../../lib/logger";
import { track } from "../../../../lib/analytics";
import { dispatchEvent } from "../../../../lib/webhooks";
export const runtime = "nodejs";

/** A workspace's paid status just changed — flips its own referral (if it
 *  was itself referred by someone) to active/inactive, and pushes the
 *  affected referrer's discount straight to Stripe. Also re-syncs the
 *  workspace's OWN discount: someone can rack up referral credit before
 *  they ever subscribe themselves, and this is the moment it should first
 *  land on their new subscription. Best-effort — a Stripe hiccup here must
 *  never fail the webhook response, since that would make Stripe retry
 *  the whole event (including the plan change, which already succeeded). */
async function onPlanChange(wsId: string, isPaid: boolean): Promise<void> {
  try {
    const referrerWsId = await syncReferralQualification(wsId, isPaid);
    if (referrerWsId) await syncReferralDiscount(referrerWsId);
    if (isPaid) await syncReferralDiscount(wsId);
  } catch { /* best effort — the plan change itself already succeeded */ }
}

const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// Stripe redelivers a webhook on any non-2xx response, and can redeliver an
// already-succeeded one too (network blip on their end reading our ack).
// Each handler below is individually near-idempotent (re-setting the same
// plan is harmless), but recordAudit() is not — it would append a duplicate
// entry per redelivery. A small capped id log turns "already processed"
// into a fast no-op instead of relying on downstream idempotence.
const MAX_PROCESSED_IDS = 1000;
// Was a capped id-array file, naturally per-row, insert-then-trim.
async function alreadyProcessed(id: string): Promise<boolean> {
  const res = await pgPool().query("SELECT 1 FROM stripe_billing_processed_events WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}
async function markProcessed(id: string): Promise<void> {
  const pool = pgPool();
  await pool.query("INSERT INTO stripe_billing_processed_events (id, processed_at) VALUES ($1, now()) ON CONFLICT (id) DO NOTHING", [id]);
  await pool.query(
    "DELETE FROM stripe_billing_processed_events WHERE id NOT IN (SELECT id FROM stripe_billing_processed_events ORDER BY processed_at DESC LIMIT $1)",
    [MAX_PROCESSED_IDS],
  );
}

// Apply a plan change ONLY if this event is at least as new as the last
// billing event already applied to the workspace, recording the event's
// `created` (Stripe's epoch-seconds ordering key) as the new high-water mark —
// all in ONE atomic UPDATE. Stripe doesn't guarantee delivery order and
// redelivers on retries, so a late, OLDER event (a stale "canceled" arriving
// after a newer "active") must never clobber newer plan state. The guard lives
// in the UPDATE's own WHERE against the target column, so Postgres re-checks it
// against the latest committed row under concurrent writers (READ COMMITTED
// EvalPlanQual) — two interleaved deliveries always converge on the newest
// event's plan, never a downgrade of a just-upgraded workspace.
//
// A null `createdAt` (only malformed/legacy events lack `created`; real Stripe
// events always carry it) applies unconditionally and leaves the mark
// untouched — the pre-ordering behaviour, so nothing regresses.
//
// Returns "applied" when the plan was set, or "stale" when a newer event had
// already been applied (a deliberate no-op). Throws "Workspace not found" when
// the workspace doesn't exist, so the caller 500s and Stripe redelivers rather
// than the event being marked processed and a paid upgrade lost (see the
// idempotency note in POST).
async function applyPlanIfNotStale(wsId: string, plan: Plan, createdAt: number | null): Promise<"applied" | "stale"> {
  const pool = pgPool();
  const upd = await pool.query(
    `UPDATE workspaces
        SET plan = $2,
            last_billing_event_at = COALESCE($3::bigint, last_billing_event_at)
      WHERE id = $1
        AND ($3::bigint IS NULL OR last_billing_event_at IS NULL OR $3::bigint >= last_billing_event_at)`,
    [wsId, plan, createdAt],
  );
  if ((upd.rowCount ?? 0) > 0) return "applied";
  // Nothing updated: either the workspace is gone, or this event is older than
  // the one already applied. Only the missing-workspace case must retry (a
  // never-applied paid upgrade would otherwise be lost); a stale event is a
  // correct no-op we can safely ack.
  const exists = await pool.query("SELECT 1 FROM workspaces WHERE id = $1", [wsId]);
  if ((exists.rowCount ?? 0) === 0) throw new Error("Workspace not found.");
  return "stale";
}

/** The workspace whose stored stripe_customer_id matches — the reverse of
 *  setWorkspaceStripeCustomer. Used only to resolve charge.refunded /
 *  charge.dispute.created events (see resolveWorkspaceIdForChargeEvent);
 *  every other event type carries its workspace id directly in its own
 *  payload and never reaches this. */
async function workspaceIdForCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const res = await pgPool().query<{ id: string }>("SELECT id FROM workspaces WHERE stripe_customer_id = $1 LIMIT 1", [customerId]);
  return res.rows[0]?.id ?? null;
}

/** Resolves the workspace id a charge.refunded / charge.dispute.created event
 *  applies to, for planEffectFromEvent's resolvedWorkspaceId parameter. A
 *  Charge carries its Stripe customer directly; a Dispute doesn't, so its
 *  underlying charge is fetched first to read THAT charge's customer — same
 *  Stripe id, one extra hop. Returns null (not actionable) for every other
 *  event type without doing any I/O.
 *
 *  A Stripe-side failure fetching the disputed charge throws rather than
 *  silently resolving to "no workspace": swallowing it would mean a dispute
 *  we genuinely can't yet identify silently never revokes access instead of
 *  retrying once Stripe/network recovers — see the money-loss note on
 *  applyPlanIfNotStale below for why this route treats "can't tell yet" as
 *  retry-worthy rather than as a no-op. */
async function resolveWorkspaceIdForChargeEvent(event: { type?: unknown; data?: { object?: Record<string, unknown> } }): Promise<string | null> {
  const obj = event.data?.object ?? {};
  if (event.type === "charge.refunded") {
    return workspaceIdForCustomer(typeof obj.customer === "string" ? obj.customer : null);
  }
  if (event.type === "charge.dispute.created") {
    const chargeId = typeof obj.charge === "string" ? obj.charge : null;
    if (!chargeId) return null;
    const charge = await getChargeCustomerId(chargeId);
    if ("error" in charge) throw new Error(`Could not resolve disputed charge's customer: ${charge.error}`);
    return workspaceIdForCustomer(charge.customerId);
  }
  return null;
}

export const POST = withRouteLogging("api/webhooks/stripe-billing:POST", async (req: Request): Promise<Response> => {
  // Comma-separated to allow zero-downtime secret ROTATION: during the overlap
  // both the old and new endpoint secret are listed, so events signed by either
  // still verify. Once the old endpoint is deleted in Stripe, drop it here.
  const secrets = (process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (secrets.length === 0) return json({ error: "STRIPE_BILLING_WEBHOOK_SECRET is not configured on this server." }, 503);

  const rawBody = await req.text();
  const result = verifyStripeSignature(rawBody, req.headers.get("stripe-signature"), secrets);
  if (!result.ok) return json({ error: result.reason ?? "Invalid signature." }, 400);

  let event: { id?: unknown; type?: unknown; created?: unknown; data?: { object?: Record<string, unknown> } };
  try { event = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON body." }, 400); }
  if (typeof event.type !== "string") return json({ error: "Missing event type." }, 400);

  // Idempotency check ONLY here — we must NOT markProcessed yet. Marking
  // before the plan change is applied is a money-loss bug: if applyPlanIfNotStale
  // (or the DB) throws below, the route 500s, Stripe redelivers, and the
  // retry would short-circuit as "duplicate" — the customer paid but never
  // got upgraded. The mark happens only after the effect is durably applied.
  if (typeof event.id === "string" && (await alreadyProcessed(event.id))) {
    return json({ received: true, duplicate: true });
  }

  // The event → plan decision is a pure function (lib/stripe-webhook,
  // unit-tested); here we only apply the effect it returns. charge.refunded
  // and charge.dispute.created don't carry a workspace id in their own
  // payload the way checkout/subscription events do, so resolve one first.
  const resolvedWorkspaceId = await resolveWorkspaceIdForChargeEvent(event);
  const effect = planEffectFromEvent(event, resolvedWorkspaceId);
  if (effect) {
    const { wsId, plan, isPaid, auditDetail, status, customerId } = effect;
    // Stripe's per-event ordering key (epoch seconds). Guards against
    // out-of-order delivery so an older event can't overwrite a newer one's
    // plan state — see applyPlanIfNotStale. Real events always carry `created`.
    const createdAt = typeof event.created === "number" && Number.isFinite(event.created) ? Math.trunc(event.created) : null;
    // Money-critical, idempotent (re-setting the same plan is harmless), AND
    // ordering-guarded: applies the plan only if this event isn't older than
    // the last one applied. Must succeed before we record the event processed.
    const outcome = await applyPlanIfNotStale(wsId, plan, createdAt);
    if (outcome === "stale") {
      // A newer billing event already won — applying this one would downgrade a
      // paying customer. Record it processed (we've handled it, by correctly
      // ignoring it) and ack, without touching plan state or firing effects.
      if (typeof event.id === "string") await markProcessed(event.id);
      return json({ received: true, stale: true });
    }
    if (customerId) await setWorkspaceStripeCustomer(wsId, customerId);
    // The plan change is now durable — safe to mark processed. If anything
    // above threw we never reach here, so Stripe's redelivery retries it
    // cleanly (the mark, not the plan change, is what would have blocked it).
    // recordAudit (non-idempotent) sits AFTER the mark so a redelivery skips
    // it rather than appending a duplicate entry.
    if (typeof event.id === "string") await markProcessed(event.id);
    await recordAudit({ actorEmail: "stripe-webhook", action: "workspace.set_plan", targetType: "workspace", targetLabel: wsId, detail: auditDetail });
    void track("plan_changed", { workspaceId: wsId, metadata: { plan } });
    if (isPaid) {
      // A paying transition reverting to free's demo lock lifts here; the
      // outbound webhook mirrors Stripe's own status where we have it.
      void dispatchEvent(wsId, "subscription.updated", status ? { plan, status } : { plan });
    } else {
      // No longer paying — revert to free rather than leaving the workspace on
      // its last-known paid plan forever. Free's read-only demo lock then
      // applies to everyone in the workspace, not just the owner.
      void dispatchEvent(wsId, "subscription.cancelled", { status });
    }
    await onPlanChange(wsId, isPaid);
  } else if (typeof event.id === "string") {
    // No plan effect (an event type we don't act on) — mark it so we don't
    // re-examine it on redelivery; there's nothing to lose by acking early.
    await markProcessed(event.id);
  }

  return json({ received: true });
});
