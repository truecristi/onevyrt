/**
 * Retargeting / controlled loops: models a portion of the population that
 * drops off at one node re-entering the funnel further upstream (an ad
 * retargeting a bounced visitor, a "didn't buy" split re-emailed back to the
 * offer). The core simulate() deliberately rejects cycles — a real feedback
 * loop needs decay to converge, and baking that into every simulate() call
 * would be wrong for the 99% of funnels that are plain DAGs. So loops live
 * here, entirely outside `funnel.edges`/topoOrder: simulate() and its 199
 * existing tests are untouched.
 *
 * Why iteration is exact, not an approximation: every node's emission is a
 * linear function of its inflow (passRate * x, conversionRate * x, a fixed
 * traffic volume plus incoming). So re-injecting decayed population and
 * re-running the DAG is exactly solving the linear feedback system by power
 * iteration — and because every decayRate < 1 and every rate is <= 1, the
 * loop gain is always < 1, so it's guaranteed to converge geometrically.
 * Each round is computed as a "delta pass": the same funnel with every
 * traffic node's own volume zeroed out, so only the newly re-injected people
 * flow through — that isolates exactly the incremental buyers/revenue/cost
 * this round of the loop caused, with nothing double-counted.
 */
import type { Funnel, NodeId, Port, SimulationResult } from "./types.ts";
import type { Minor } from "./money.ts";
import { simulate } from "./simulate.ts";

export interface RetargetingLoop {
  id: string;
  fromNodeId: NodeId;
  fromPort: Port;   // which emission to recapture (e.g. "no" — the drop-offs)
  toNodeId: NodeId; // where the recaptured population re-enters
  decayRate: number; // 0..1 — fraction of that emission that actually re-enters
}

export interface RetargetingTotals {
  visitors: number;
  buyers: number;
  revenue: Minor;
  cost: Minor;
  grossProfit: Minor;
  mrr?: Minor;
  ltv?: Minor;
}

export interface RetargetingResult {
  basePass: SimulationResult;
  iterations: number;
  /** true if it hit maxIterations still above epsilon — numbers are a lower
   *  bound in that case, not the fully-converged total. */
  truncated: boolean;
  totals: RetargetingTotals;
}

/**
 * The funnel used for each retargeting delta pass. It must carry ONLY the
 * costs that scale with the extra recirculated traffic — otherwise every pass
 * re-books the funnel's fixed costs and inflates total cost by
 * (iterations × fixed cost). So we zero every FLAT amount (traffic spend, each
 * node's flat `expenseAmount`, and the scenario-wide `expenses.amount`) while
 * leaving the revenue-proportional rates (`expenseRate`, `expenses.rate`,
 * merchant fees, per-visitor cost, COGS) intact so incremental traffic is still
 * costed correctly.
 */
function zeroTrafficFunnel(funnel: Funnel): Funnel {
  return {
    ...funnel,
    nodes: funnel.nodes.map((n) => ({
      ...n,
      ...(n.kind === "traffic" ? { visitors: 0, flatCost: 0 } : {}),
      expenseAmount: 0, // flat per-node operating expense — counted once in basePass, not per pass
    })),
    expenses: funnel.expenses ? { ...funnel.expenses, amount: 0 } : funnel.expenses,
  };
}

export function simulateWithRetargeting(
  funnel: Funnel,
  loops: RetargetingLoop[],
  opts: { maxIterations?: number; epsilon?: number } = {},
): RetargetingResult {
  const maxIterations = opts.maxIterations ?? 20;
  const epsilon = opts.epsilon ?? 0.01;

  const basePass = simulate(funnel);
  if (loops.length === 0) {
    return { basePass, iterations: 0, truncated: false, totals: { ...basePass.totals } };
  }

  const deltaFunnel = zeroTrafficFunnel(funnel);
  const totals: RetargetingTotals = { ...basePass.totals };

  let lastResult: SimulationResult = basePass;
  let iterations = 0;
  let truncated = false;

  for (let i = 0; i < maxIterations; i++) {
    const extraInflow: Record<NodeId, number> = {};
    let anyAboveEpsilon = false;
    for (const loop of loops) {
      const emitted = lastResult.nodes[loop.fromNodeId]?.emissions[loop.fromPort] ?? 0;
      const injected = emitted * loop.decayRate;
      if (injected > epsilon) anyAboveEpsilon = true;
      extraInflow[loop.toNodeId] = (extraInflow[loop.toNodeId] ?? 0) + injected;
    }
    if (!anyAboveEpsilon) break;

    const deltaResult = simulate(deltaFunnel, extraInflow);
    totals.buyers += deltaResult.totals.buyers;
    totals.revenue += deltaResult.totals.revenue;
    totals.cost += deltaResult.totals.cost;
    if (deltaResult.totals.mrr) totals.mrr = (totals.mrr ?? 0) + deltaResult.totals.mrr;
    if (deltaResult.totals.ltv) totals.ltv = (totals.ltv ?? 0) + deltaResult.totals.ltv;
    lastResult = deltaResult;
    iterations = i + 1;
    // Truncated only if we're out of iterations AND the just-finished pass would
    // STILL inject above epsilon next round — i.e. it hasn't actually converged.
    // (Previously this fired on the last pass unconditionally, so a funnel that
    // converged exactly at maxIterations was mislabelled as still decaying.)
    if (i === maxIterations - 1) {
      truncated = loops.some((loop) =>
        (lastResult.nodes[loop.fromNodeId]?.emissions[loop.fromPort] ?? 0) * loop.decayRate > epsilon,
      );
    }
  }
  totals.grossProfit = totals.revenue - totals.cost;

  return { basePass, iterations, truncated, totals };
}
