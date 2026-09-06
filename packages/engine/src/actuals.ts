/**
 * ACTUAL data: observed, real-world numbers entered against a funnel — kept
 * completely separate from the PLAN assumptions in the graph. Nothing here
 * ever mutates a FunnelNode; ACTUAL and PLAN coexist. This is the foundation
 * of the Reality Loop (PLAN -> ACTUAL -> VARIANCE).
 */
import type { Minor } from "./money.ts";
import type { NodeId } from "./types.ts";

/** Observed metrics for a single node. All optional: only what was measured.
 *  Money fields are integer minor units, like the rest of the engine. */
export interface NodeActuals {
  visitors?: number;  // observed traffic (traffic nodes)
  buyers?: number;    // observed purchases (offer nodes)
  revenue?: Minor;    // observed revenue (offer nodes)
  cost?: Minor;       // observed spend (traffic nodes)
}

/** Observed values keyed by node id. */
export type Actuals = Record<NodeId, NodeActuals>;

/** Same shape as a plan's headline totals, so PLAN and ACTUAL are comparable. */
export interface ActualTotals {
  visitors: number;
  buyers: number;
  revenue: Minor;
  cost: Minor;
  grossProfit: Minor;
}

/** Roll observed per-node values up into headline totals. Pure + total:
 *  missing measurements contribute zero, never NaN. */
export function aggregateActuals(actuals: Actuals): ActualTotals {
  let visitors = 0, buyers = 0, revenue = 0, cost = 0;
  for (const a of Object.values(actuals)) {
    if (a.visitors) visitors += a.visitors;
    if (a.buyers) buyers += a.buyers;
    if (a.revenue) revenue += a.revenue;
    if (a.cost) cost += a.cost;
  }
  return { visitors, buyers, revenue, cost, grossProfit: revenue - cost };
}

/** True if any measurement has been entered at all. */
export function hasActuals(actuals: Actuals): boolean {
  return Object.values(actuals).some(
    (a) => a.visitors != null || a.buyers != null || a.revenue != null || a.cost != null,
  );
}
