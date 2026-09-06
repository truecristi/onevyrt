// Risk Engine (spec Chapter 16 / 52). Local-first, deterministic, no cloud.
// Everything here is pure: given a Funnel it returns risk facts derived only
// from the deterministic simulate() output. No randomness, no I/O.
import type { Funnel, FunnelNode, NodeId } from "./types.ts";
import { simulate } from "./simulate.ts";

export interface Sensitivity {
  nodeId: NodeId;
  label: string;
  field: string;
  /** grossProfit change (minor units) for a +10% move in this field. */
  deltaProfitUp: number;
  /** grossProfit change (minor units) for a -10% move in this field. */
  deltaProfitDown: number;
  /** the larger absolute swing of the two, used for ranking. */
  magnitude: number;
}

export interface BreakEven {
  /** multiplier applied to ALL traffic volume that drives grossProfit to 0.
   *  < 1 means you can lose traffic and still profit; > 1 means you need more
   *  than planned just to break even (fragile); null if unreachable. */
  trafficMultiplier: number | null;
  /** multiplier on every conversion/pass rate that reaches break-even. */
  conversionMultiplier: number | null;
  /** the plan's grossProfit at the current assumptions (minor units). */
  planProfit: number;
}

export interface AssumptionFlag {
  nodeId: NodeId;
  label: string;
  field: string;
  value: number;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface CaseRange {
  /** grossProfit (minor units) if traffic AND conversion/pass rates both move
   *  against you by `spread` at the same time — not just one lever, the
   *  simultaneous worst-plausible combination. */
  worst: number;
  /** the plan's grossProfit at current assumptions, unchanged. */
  likely: number;
  /** grossProfit if both move in your favor by `spread` at the same time. */
  best: number;
  /** the +/- percentage applied to traffic and rates for worst/best. */
  spread: number;
}

export interface RiskReport {
  /** 0 (rock solid) .. 100 (extremely fragile). */
  score: number;
  band: "low" | "moderate" | "high" | "critical";
  planProfit: number;
  margin: number;            // grossProfit / revenue, 0..1 (0 if no revenue)
  breakEven: BreakEven;
  sensitivities: Sensitivity[];   // ranked, biggest first
  assumptions: AssumptionFlag[];
  caseRange: CaseRange;
  headline: string;
}

const PERTURB_FIELDS: Record<FunnelNode["kind"], string[]> = {
  traffic: ["visitors", "costPerVisitor"],
  step: ["passRate"],
  offer: ["conversionRate", "price"],
  split: ["yesRate"],
};

function profitOf(f: Funnel): number {
  const r = simulate(f);
  return r.totals.grossProfit;
}

function clonePerturbed(f: Funnel, nodeId: NodeId, field: string, factor: number): Funnel {
  return {
    ...f,
    nodes: f.nodes.map((n) => {
      if (n.id !== nodeId) return n;
      const cur = (n as unknown as Record<string, number>)[field];
      if (typeof cur !== "number") return n;
      let next = cur * factor;
      // rates are bounded 0..1; keep perturbations valid
      if (field === "passRate" || field === "conversionRate" || field === "yesRate") {
        next = Math.max(0, Math.min(1, next));
      }
      return { ...n, [field]: next } as FunnelNode;
    }),
  };
}

export function computeSensitivities(f: Funnel): Sensitivity[] {
  const base = profitOf(f);
  const out: Sensitivity[] = [];
  for (const n of f.nodes) {
    for (const field of PERTURB_FIELDS[n.kind]) {
      const cur = (n as unknown as Record<string, number>)[field];
      if (typeof cur !== "number" || cur === 0) continue;
      const up = profitOf(clonePerturbed(f, n.id, field, 1.1)) - base;
      const down = profitOf(clonePerturbed(f, n.id, field, 0.9)) - base;
      const magnitude = Math.max(Math.abs(up), Math.abs(down));
      if (magnitude === 0) continue;
      out.push({
        nodeId: n.id, label: n.label ?? n.id, field,
        deltaProfitUp: Math.round(up), deltaProfitDown: Math.round(down),
        magnitude: Math.round(magnitude),
      });
    }
  }
  out.sort((a, b) => b.magnitude - a.magnitude);
  return out;
}

/** Bisection: find the multiplier m in [lo,hi] on a field-family that zeroes profit. */
function solveMultiplier(f: Funnel, apply: (f: Funnel, m: number) => Funnel, lo: number, hi: number): number | null {
  const pLo = profitOf(apply(f, lo));
  const pHi = profitOf(apply(f, hi));
  if ((pLo <= 0 && pHi <= 0) || (pLo > 0 && pHi > 0)) return null; // no sign change
  let a = lo, b = hi;
  for (let i = 0; i < 40; i++) {
    const mid = (a + b) / 2;
    const pm = profitOf(apply(f, mid));
    if (Math.abs(pm) < 1) return Math.round(mid * 1000) / 1000;
    const pa = profitOf(apply(f, a));
    if ((pa <= 0) === (pm <= 0)) a = mid; else b = mid;
  }
  return Math.round(((a + b) / 2) * 1000) / 1000;
}

const scaleAllTraffic = (f: Funnel, m: number): Funnel => ({
  ...f, nodes: f.nodes.map((n) => n.kind === "traffic" ? { ...n, visitors: n.visitors * m } : n),
});
const scaleAllRates = (f: Funnel, m: number): Funnel => ({
  ...f, nodes: f.nodes.map((n) => {
    if (n.kind === "step") return { ...n, passRate: Math.min(1, n.passRate * m) };
    if (n.kind === "offer") return { ...n, conversionRate: Math.min(1, n.conversionRate * m) };
    return n;
  }),
});

/** Worst/likely/best case: scales traffic volume AND conversion/pass rates
 *  together by the same +/- spread, since a real downturn rarely hits just
 *  one lever — this is deliberately more pessimistic (and more realistic)
 *  than reading the single worst sensitivity in isolation. */
export function computeCaseRange(f: Funnel, spread = 0.15): CaseRange {
  const likely = profitOf(f);
  const worst = profitOf(scaleAllRates(scaleAllTraffic(f, 1 - spread), 1 - spread));
  const best = profitOf(scaleAllRates(scaleAllTraffic(f, 1 + spread), 1 + spread));
  return { worst: Math.round(worst), likely: Math.round(likely), best: Math.round(best), spread };
}

export function computeBreakEven(f: Funnel): BreakEven {
  const planProfit = profitOf(f);
  return {
    planProfit,
    trafficMultiplier: solveMultiplier(f, scaleAllTraffic, 0, 5),
    conversionMultiplier: solveMultiplier(f, scaleAllRates, 0, 5),
  };
}

export function flagAssumptions(f: Funnel): AssumptionFlag[] {
  const flags: AssumptionFlag[] = [];
  for (const n of f.nodes) {
    if (n.kind === "step" && typeof n.passRate === "number") {
      if (n.passRate > 0.9) flags.push({ nodeId: n.id, label: n.label ?? n.id, field: "passRate", value: n.passRate, severity: "high", message: "Pass rate above 90% is optimistic for most steps." });
      else if (n.passRate < 0.05) flags.push({ nodeId: n.id, label: n.label ?? n.id, field: "passRate", value: n.passRate, severity: "medium", message: "Very low pass rate — check this step is realistic." });
    }
    if (n.kind === "offer" && typeof n.conversionRate === "number") {
      if (n.conversionRate > 0.5) flags.push({ nodeId: n.id, label: n.label ?? n.id, field: "conversionRate", value: n.conversionRate, severity: "high", message: "Offer conversion above 50% is rare — verify." });
    }
    if (n.kind === "traffic" && typeof n.visitors === "number" && n.visitors === 0) {
      flags.push({ nodeId: n.id, label: n.label ?? n.id, field: "visitors", value: 0, severity: "medium", message: "Traffic source has zero visitors." });
    }
  }
  return flags;
}

export function assessRisk(f: Funnel): RiskReport {
  const sim = simulate(f);
  const planProfit = sim.totals.grossProfit;
  const revenue = sim.totals.revenue;
  const margin = revenue > 0 ? planProfit / revenue : 0;
  const breakEven = computeBreakEven(f);
  const sensitivities = computeSensitivities(f);
  const assumptions = flagAssumptions(f);
  const caseRange = computeCaseRange(f);

  // Score: thin margin, fragile break-even, concentrated sensitivity, bad flags.
  let score = 0;
  if (planProfit <= 0) score += 55;
  else {
    if (margin < 0.1) score += 30; else if (margin < 0.25) score += 18; else if (margin < 0.4) score += 8;
    const tm = breakEven.trafficMultiplier;
    if (tm != null && tm > 0.9) score += 25; else if (tm != null && tm > 0.75) score += 12;
  }
  score += Math.min(20, assumptions.reduce((s, a) => s + (a.severity === "high" ? 8 : a.severity === "medium" ? 4 : 2), 0));
  if (sensitivities.length && planProfit > 0) {
    const top = sensitivities[0].magnitude;
    if (top > Math.abs(planProfit) * 0.5) score += 10; // one lever swings >50% of profit
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const band: RiskReport["band"] = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "moderate" : "low";
  const headline = planProfit <= 0
    ? "This plan does not profit at current assumptions."
    : band === "low" ? "Solid plan with healthy margin and headroom."
    : band === "moderate" ? "Workable, but a few assumptions carry real risk."
    : band === "high" ? "Fragile — small misses could erase profit."
    : "Critical — the plan breaks under minor variance.";

  return { score, band, planProfit, margin: Math.round(margin * 1000) / 1000, breakEven, sensitivities, assumptions, caseRange, headline };
}
