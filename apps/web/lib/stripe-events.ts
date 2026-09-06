/**
 * Stripe webhook event log: a capped, append-only record of verified
 * incoming events — used for the admin "what's landed" view and to pull
 * completed checkouts into ACTUAL. Shared by the webhook receiver
 * (app/api/webhooks/stripe/route.ts) and the admin overview route, which
 * is why this lives in lib/ rather than inline in either route file.
 * Postgres-backed (see lib/db.ts).
 *
 * Every event is scoped to a workspace (workspace_id), taken from the
 * Stripe object's client_reference_id / metadata.workspaceId. Reads are
 * per-workspace, and the cap is per-workspace too, so one busy workspace
 * can never evict another's history. Events with no attribution are stored
 * with a null workspace_id and simply never surface in a scoped read.
 */
import { pgPool } from "./db";

export interface StripeEvent {
  id: string;
  type: string;
  receivedAt: string;
  workspaceId?: string;
  amountTotal?: number;
  currency?: string;
  customerEmail?: string;
}

// Per-workspace cap (was a single global cap, which let tenants evict each
// other). Kept modest — this is a recent-activity log, not an archive.
const MAX_EVENTS_PER_WS = 500;

/** Appends a verified event, scoped to a workspace. Idempotent by event id
 *  — a Stripe webhook retry (which Stripe does routinely) must not
 *  double-count revenue in the stats view. Trims only within the event's
 *  own workspace bucket so busy tenants don't evict quiet ones. Returns
 *  whether the row was NEWLY inserted (false on a retry), so the caller can
 *  fold the event into the durable revenue ledger exactly once. */
export async function recordStripeEvent(e: StripeEvent): Promise<boolean> {
  const pool = pgPool();
  const ins = await pool.query(
    "INSERT INTO stripe_events (id, type, received_at, workspace_id, amount_total, currency, customer_email) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING RETURNING id",
    [e.id, e.type, e.receivedAt, e.workspaceId ?? null, e.amountTotal ?? null, e.currency ?? null, e.customerEmail ?? null],
  );
  // Trim within this workspace bucket only. `IS NOT DISTINCT FROM` groups
  // the null-workspace (unattributed) events into their own bucket rather
  // than mixing them with every workspace's rows.
  await pool.query(
    `DELETE FROM stripe_events
       WHERE workspace_id IS NOT DISTINCT FROM $1
         AND id NOT IN (
           SELECT id FROM stripe_events
             WHERE workspace_id IS NOT DISTINCT FROM $1
             ORDER BY received_at DESC LIMIT $2
         )`,
    [e.workspaceId ?? null, MAX_EVENTS_PER_WS],
  );
  return (ins.rowCount ?? 0) > 0;
}

function mapRows(rows: Record<string, unknown>[]): StripeEvent[] {
  return rows.map((r) => ({
    id: r.id as string, type: r.type as string,
    receivedAt: (r.received_at instanceof Date ? r.received_at.toISOString() : r.received_at as string),
    ...(r.workspace_id ? { workspaceId: r.workspace_id as string } : {}),
    ...(r.amount_total != null ? { amountTotal: r.amount_total as number } : {}),
    ...(r.currency ? { currency: r.currency as string } : {}),
    ...(r.customer_email ? { customerEmail: r.customer_email as string } : {}),
  }));
}

/** Events for one workspace, oldest first. Never returns another
 *  workspace's rows, and never the unattributed (null) bucket. */
export async function listStripeEvents(workspaceId: string): Promise<StripeEvent[]> {
  const res = await pgPool().query(
    "SELECT id, type, received_at, workspace_id, amount_total, currency, customer_email FROM stripe_events WHERE workspace_id = $1 ORDER BY received_at ASC",
    [workspaceId],
  );
  return mapRows(res.rows);
}

/** Every event across every workspace, oldest first — the instance-wide
 *  operator view. ADMIN ONLY: callers must gate with requireAdmin before
 *  calling this, since it crosses tenant boundaries by design. */
export async function listAllStripeEvents(): Promise<StripeEvent[]> {
  const res = await pgPool().query(
    "SELECT id, type, received_at, workspace_id, amount_total, currency, customer_email FROM stripe_events ORDER BY received_at ASC",
  );
  return mapRows(res.rows);
}
