/**
 * VARIANCE: compare a PLAN simulation against observed ACTUAL values and
 * attribute the plan-vs-actual profit gap to individual nodes. Node-level
 * attribution covers offer REVENUE deltas and traffic COST deltas — the two
 * dimensions the simulator tracks per node from actuals. It does NOT capture
 * offer-side variable costs (COGS, merchant fees, refunds) or operating
 * expenses, because actuals don't record those per node. So the node impacts
 * do not always sum to the full gap: `unexplained` holds the remainder
 * (profitGap − Σ profitImpact), which is 0 for a plan with no offer costs or
 * expenses and non-zero otherwise. Reporting it keeps the reconciliation honest
 * instead of silently leaving a residual. Read-only: nothing here mutates PLAN
 * or ACTUAL.
 */
import type { Minor } from "./money.ts";
import type { NodeId, SimulationResult } from "./types.ts";
import type { Actuals } from "./actuals.ts";
import { aggregateActuals } from "./actuals.ts";

export interface NodeVariance {
  nodeId: NodeId;
  kind: string;
  metric: "revenue" | "cost";  // the money dimension this node owns
  plan: Minor;
  actual: Minor;
  moneyDelta: Minor;           // actual - plan, in the metric
  profitImpact: Minor;         // signed contribution to the profit gap
  pctOffPlan: number | null;   // (actual - plan) / plan; null when plan is 0
  leak: boolean;               // profitImpact < 0 (reality hurt profit here)
}

export interface VarianceReport {
  nodes: NodeVariance[];       // money-bearing nodes that have actuals
  planProfit: Minor;
  actualProfit: Minor;
  profitGap: Minor;            // actualProfit - planProfit
  unexplained: Minor;          // profitGap - Σ profitImpact (offer-side costs & expenses not attributable per node); 0 when none
  biggestLeak: NodeVariance | null;
  ranked: NodeVariance[];      // worst profitImpact first
}

export function computeVariance(plan: SimulationResult, actuals: Actuals): VarianceReport {
  const nodes: NodeVariance[] = [];
  for (const [id, a] of Object.entries(actuals)) {
    const pn = plan.nodes[id];
    if (!pn) continue;

    if (pn.kind === "offer" && a.revenue != null) {
      const planV = pn.revenue, actualV = a.revenue, delta = actualV - planV;
      nodes.push({
        nodeId: id, kind: pn.kind, metric: "revenue",
        plan: planV, actual: actualV, moneyDelta: delta, profitImpact: delta,
        pctOffPlan: planV !== 0 ? delta / planV : null, leak: delta < 0,
      });
    } else if (pn.kind === "traffic" && a.cost != null) {
      const planV = pn.cost, actualV = a.cost, delta = actualV - planV;
      nodes.push({
        nodeId: id, kind: pn.kind, metric: "cost",
        plan: planV, actual: actualV, moneyDelta: delta, profitImpact: -delta,
        pctOffPlan: planV !== 0 ? delta / planV : null, leak: -delta < 0,
      });
    }
  }

  const planProfit = plan.totals.grossProfit;
  const actualProfit = aggregateActuals(actuals).grossProfit;
  const profitGap = actualProfit - planProfit;
  const attributed = nodes.reduce((sum, n) => sum + n.profitImpact, 0);
  const unexplained = profitGap - attributed;
  const ranked = [...nodes].sort((x, y) => x.profitImpact - y.profitImpact);
  const biggestLeak = ranked.length > 0 && ranked[0].profitImpact < 0 ? ranked[0] : null;

  return { nodes, planProfit, actualProfit, profitGap, unexplained, biggestLeak, ranked };
}
