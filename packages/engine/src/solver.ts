/**
 * Goal Solver (Ch.027): "what must change to hit a target?"
 * Single-variable, deterministic. Given a target metric value and one lever
 * (a numeric field on a node) with bounds, find the lever value that reaches
 * the target. Uses bisection over the deterministic simulation — the model is
 * monotonic in each lever, so a bracketed root is unique. Pure + testable.
 */
import { simulate } from "./simulate.ts";
import { applyScenario } from "./scenarios.ts";
import type { Funnel, NodeId, SimulationResult } from "./types.ts";

export type GoalMetric = "grossProfit" | "revenue" | "buyers" | "cost" | "mrr" | "ltv";

export interface GoalTarget { metric: GoalMetric; value: number; }
export interface GoalLever { nodeId: NodeId; field: string; min: number; max: number; }

export interface SolveResult {
  reachable: boolean;   // could the target be hit within the lever bounds?
  leverValue: number;   // solved value (or the closest bound when unreachable)
  achieved: number;     // metric value at leverValue
  target: number;
  iterations: number;
}

function metricOf(t: SimulationResult["totals"], m: GoalMetric): number {
  switch (m) {
    case "grossProfit": return t.grossProfit;
    case "revenue": return t.revenue;
    case "buyers": return t.buyers;
    case "cost": return t.cost;
    case "mrr": return t.mrr ?? 0;
    case "ltv": return t.ltv ?? 0;
  }
}

export function solveGoal(
  funnel: Funnel,
  target: GoalTarget,
  lever: GoalLever,
  opts?: { maxIter?: number },
): SolveResult {
  const maxIter = opts?.maxIter ?? 80;
  const evalAt = (x: number): number => {
    const f = applyScenario(funnel, { id: "_solve", name: "_solve", overrides: [{ nodeId: lever.nodeId, field: lever.field, value: x }] });
    return metricOf(simulate(f).totals, target.metric);
  };

  let lo = lever.min, hi = lever.max;
  const at = (x: number) => evalAt(x) - target.value;
  const fLo = at(lo), fHi = at(hi);

  if (fLo === 0) return { reachable: true, leverValue: lo, achieved: evalAt(lo), target: target.value, iterations: 0 };
  if (fHi === 0) return { reachable: true, leverValue: hi, achieved: evalAt(hi), target: target.value, iterations: 0 };

  // target not bracketed by the bounds -> unreachable; return the closer endpoint
  if ((fLo > 0) === (fHi > 0)) {
    const pick = Math.abs(fLo) <= Math.abs(fHi) ? lo : hi;
    return { reachable: false, leverValue: pick, achieved: evalAt(pick), target: target.value, iterations: 0 };
  }

  const span = Math.max(Math.abs(hi - lo), 1e-9);
  let iter = 0;
  while (iter < maxIter && (hi - lo) > span * 1e-9) {
    const mid = (lo + hi) / 2;
    const fMid = at(mid);
    if (fMid === 0) { return { reachable: true, leverValue: mid, achieved: evalAt(mid), target: target.value, iterations: iter }; }
    if ((fMid > 0) === (fLo > 0)) lo = mid; else hi = mid;
    iter++;
  }
  const mid = (lo + hi) / 2;
  return { reachable: true, leverValue: mid, achieved: evalAt(mid), target: target.value, iterations: iter };
}
