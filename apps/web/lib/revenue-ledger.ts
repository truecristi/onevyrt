/**
 * Durable per-workspace revenue ledger (see migration
 * 1786652000000_workspace-revenue-ledger). A running gross/refunded total per
 * (workspace, currency) that survives the stripe_events cap, so "total
 * collected" stays cumulative instead of shrinking as old events are evicted.
 *
 * Written from the Stripe webhook receiver on each NEWLY-recorded event
 * (retries are idempotent because the event log dedupes by Stripe event id
 * before we ever get here — see recordStripeEvent's `inserted` return). Read by
 * the per-workspace stats endpoint, which prefers this over summing the log.
 */
import { pgPool } from "./db";
import type { RevenueDelta } from "./acquisition/funnel-conversion";

export interface WorkspaceRevenue {
  currency: string;
  grossCents: number;
  refundedCents: number;
  /** gross − refunded, floored at 0 (a currency should never read negative). */
  netCents: number;
  saleCount: number;
  refundCount: number;
}

/** Fold one event's delta into the (workspace, currency) running totals. */
export async function applyRevenueDelta(workspaceId: string, d: RevenueDelta): Promise<void> {
  await pgPool().query(
    `INSERT INTO workspace_revenue (workspace_id, currency, gross_cents, refunded_cents, sale_count, refund_count)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (workspace_id, currency) DO UPDATE SET
       gross_cents = workspace_revenue.gross_cents + EXCLUDED.gross_cents,
       refunded_cents = workspace_revenue.refunded_cents + EXCLUDED.refunded_cents,
       sale_count = workspace_revenue.sale_count + EXCLUDED.sale_count,
       refund_count = workspace_revenue.refund_count + EXCLUDED.refund_count`,
    [workspaceId, d.currency, d.grossCents, d.refundedCents, d.saleCount, d.refundCount],
  );
}

/** The running totals for a workspace, one row per currency it has taken. */
export async function getWorkspaceRevenue(workspaceId: string): Promise<WorkspaceRevenue[]> {
  const r = await pgPool().query<{ currency: string; gross_cents: string; refunded_cents: string; sale_count: number; refund_count: number }>(
    "SELECT currency, gross_cents, refunded_cents, sale_count, refund_count FROM workspace_revenue WHERE workspace_id = $1",
    [workspaceId],
  );
  return r.rows.map((row) => {
    const gross = Number(row.gross_cents);
    const refunded = Number(row.refunded_cents);
    return {
      currency: row.currency,
      grossCents: gross,
      refundedCents: refunded,
      netCents: Math.max(0, gross - refunded),
      saleCount: Number(row.sale_count),
      refundCount: Number(row.refund_count),
    };
  });
}

/** Pure: pick the dominant currency (largest net) and shape the ledger rows the
 *  stats endpoint returns — the eviction-proof replacement for summing the log.
 *  Exported for testing. Returns null when the ledger has nothing for the
 *  workspace, so the caller can fall back to the event-log summary. */
export function dominantRevenue(rows: WorkspaceRevenue[]): { completedCount: number; completedAmountTotal: number; grossAmountTotal: number; refundedAmountTotal: number; currency: string | null; mixedCurrency: boolean } | null {
  if (rows.length === 0) return null;
  let best = rows[0]!;
  for (const r of rows) if (r.netCents > best.netCents) best = r;
  return {
    completedCount: best.saleCount,
    completedAmountTotal: best.netCents,
    grossAmountTotal: best.grossCents,
    refundedAmountTotal: best.refundedCents,
    currency: best.currency || null,
    mixedCurrency: rows.length > 1,
  };
}
