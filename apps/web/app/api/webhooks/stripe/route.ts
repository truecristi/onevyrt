/**
 * Stripe webhook receiver (Ch. integrations). Verifies every request against
 * STRIPE_WEBHOOK_SECRET (from the user's own Stripe dashboard — an endpoint
 * secret, not an API key, and never something we hold or generate). Unverified
 * requests are rejected outright; nothing is ever recorded on a bad signature.
 * Validated events append to the shared stripe-events log (see lib/stripe-events.ts),
 * scoped to the workspace named in the Stripe object's client_reference_id /
 * metadata.workspaceId.
 */
import { verifyStripeSignature } from "../../../../lib/stripe-webhook";
import { withRouteLogging } from "../../../../lib/logger";
import { recordStripeEvent, listStripeEvents } from "../../../../lib/stripe-events";
import { classifyStripeEvent, summarizeCompleted, revenueDeltaFor } from "../../../../lib/acquisition/funnel-conversion";
import { applyRevenueDelta, getWorkspaceRevenue, dominantRevenue } from "../../../../lib/revenue-ledger";
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
export const runtime = "nodejs";

const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging("api/webhooks/stripe:POST", async (req: Request): Promise<Response> => {
  // Comma-separated to allow zero-downtime secret ROTATION: during the overlap
  // both the old and new endpoint secret are listed, so events signed by either
  // still verify. Once the old endpoint is deleted in Stripe, drop it here.
  const secrets = (process.env.STRIPE_WEBHOOK_SECRET ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (secrets.length === 0) return json({ error: "STRIPE_WEBHOOK_SECRET is not configured on this server." }, 503);

  const rawBody = await req.text();
  const result = verifyStripeSignature(rawBody, req.headers.get("stripe-signature"), secrets);
  if (!result.ok) return json({ error: result.reason ?? "Invalid signature." }, 400);

  let event: { id?: unknown; type?: unknown; data?: { object?: Record<string, unknown> } };
  try { event = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON body." }, 400); }
  if (typeof event.id !== "string" || typeof event.type !== "string") return json({ error: "Missing event id/type." }, 400);

  const obj = event.data?.object ?? {};
  // Workspace attribution + type normalisation live in one pure classifier
  // (lib/acquisition/funnel-conversion). It reads workspace from
  // client_reference_id (external Checkout) or metadata.workspaceId (the funnel
  // paid step), and re-types a funnel-stamped payment_intent.succeeded to a
  // distinct funnel event so it's counted once as revenue and never confused
  // with the external Checkout events. No attribution → stored with a null
  // workspace and never surfaced in any workspace's view.
  const c = classifyStripeEvent(event.type, obj);
  const inserted = await recordStripeEvent({
    id: event.id,
    type: c.recordType,
    receivedAt: new Date().toISOString(),
    ...(c.workspaceId ? { workspaceId: c.workspaceId } : {}),
    ...(c.amountTotal != null ? { amountTotal: c.amountTotal } : {}),
    ...(c.currency ? { currency: c.currency } : {}),
    ...(c.customerEmail ? { customerEmail: c.customerEmail } : {}),
  });

  // Fold a completed sale (gross+) or refund (refunded-) into the durable
  // per-workspace ledger — but ONLY when the event was newly recorded, so a
  // Stripe retry (deduped by event id above) never double-counts. The ledger is
  // the eviction-proof source for "total collected" (the log is capped).
  if (inserted && c.workspaceId) {
    const delta = revenueDeltaFor({ type: c.recordType, amountTotal: c.amountTotal, currency: c.currency, workspaceId: c.workspaceId });
    if (delta) { try { await applyRevenueDelta(c.workspaceId, delta); } catch { /* stats bookkeeping only */ } }
  }

  return json({ received: true });
});

/** Lets the UI show what's landed and pull it into ACTUAL — aggregated only,
 *  never the raw event dump (no customer emails leave this endpoint), and
 *  ONLY for a workspace the caller is a member of. This used to be an
 *  unauthenticated, instance-wide read — anyone could pull every workspace's
 *  revenue. It now requires a signed-in member and returns only that
 *  workspace's aggregates. */
export const GET = withRouteLogging("api/webhooks/stripe:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const configured = !!process.env.STRIPE_WEBHOOK_SECRET;
  let count = 0;
  let lastReceivedAt: string | null = null;
  // completedAmountTotal is the eviction-proof NET (gross − refunds) from the
  // durable ledger, reported in the dominant currency — never a cross-currency
  // sum. summarizeCompleted over the (capped) event log is the fallback for a
  // workspace with no ledger rows yet, so the figure degrades gracefully rather
  // than reading 0. totalCompletedCount comes from the log's recent activity.
  let money = { completedCount: 0, completedAmountTotal: 0, currency: null as string | null, mixedCurrency: false, grossAmountTotal: 0, refundedAmountTotal: 0 };
  let totalCompletedCount = 0;
  try {
    const events = await listStripeEvents(wsId);
    count = events.length;
    lastReceivedAt = events[events.length - 1]?.receivedAt ?? null;
    const logSummary = summarizeCompleted(events);
    totalCompletedCount = logSummary.totalCompletedCount;
    const ledger = dominantRevenue(await getWorkspaceRevenue(wsId));
    money = ledger ?? {
      completedCount: logSummary.completedCount,
      completedAmountTotal: logSummary.completedAmountTotal,
      currency: logSummary.currency,
      mixedCurrency: logSummary.mixedCurrency,
      grossAmountTotal: logSummary.completedAmountTotal,
      refundedAmountTotal: 0,
    };
  } catch { /* no events yet */ }
  return json({ configured, count, lastReceivedAt, ...money, totalCompletedCount });
});
