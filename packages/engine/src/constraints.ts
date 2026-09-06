// Constraints Engine (spec Chapter 17). Distinct from risk.ts: risk is soft and
// probabilistic (scoring, sensitivity); constraints are HARD limits the plan
// must respect, each checked once against the deterministic simulate() output.
import type { Funnel, NodeId } from "./types.ts";
import type { Minor } from "./money.ts";
import { simulate } from "./simulate.ts";

export type ConstraintKind = "budget_cap" | "capacity_limit" | "rate_limit" | "min_threshold";
export type ThresholdMetric = "cpa" | "roas";
export type Severity = "ok" | "warning" | "violated";

/** Ceiling on total ad spend (sim.totals.cost), in minor units. */
export interface BudgetCapConstraint {
  id: string;
  kind: "budget_cap";
  label?: string;
  limitMinor: Minor;
}

/** Ceiling on the units a single step/offer node may carry (its inflow). */
export interface CapacityLimitConstraint {
  id: string;
  kind: "capacity_limit";
  label?: string;
  nodeId: NodeId;
  maxUnits: number;
}

/** Ceiling on visitor volume drawn from one traffic source. */
export interface RateLimitConstraint {
  id: string;
  kind: "rate_limit";
  label?: string;
  nodeId: NodeId;
  maxVisitors: number;
}

/** A funnel-wide ratio that must stay on the right side of a value:
 *  cpa (cost / buyers) capped from above, or roas (revenue / cost) floored
 *  from below. */
export interface MinThresholdConstraint {
  id: string;
  kind: "min_threshold";
  label?: string;
  metric: ThresholdMetric;
  direction: "under" | "over"; // "under" caps the metric, "over" floors it
  value: number;
}

export type Constraint =
  | BudgetCapConstraint
  | CapacityLimitConstraint
  | RateLimitConstraint
  | MinThresholdConstraint;

export interface ConstraintResult {
  id: string;
  kind: ConstraintKind;
  label: string;
  satisfied: boolean;
  actual: number;
  limit: number;
  /** Fractional headroom relative to the limit: >= 0 satisfied (bigger = safer),
   *  < 0 the amount by which the constraint is violated. */
  margin: number;
  severity: Severity;
  /** Set only for min_threshold results, so callers can format actual/limit
   *  correctly (cpa is money, roas is a plain ratio) without re-deriving it. */
  metric?: ThresholdMetric;
}

export interface ConstraintReport {
  results: ConstraintResult[];
  violated: ConstraintResult[];
  allSatisfied: boolean;
  worstSeverity: Severity;
}

const WARNING_BAND = 0.1; // within 10% of the limit still counts as "watch this"

function classify(margin: number): Severity {
  if (margin < 0) return "violated";
  if (margin < WARNING_BAND) return "warning";
  return "ok";
}

function labelOf(c: Constraint): string {
  return c.label ?? c.id;
}

function nodeLabel(f: Funnel, nodeId: NodeId): string {
  return f.nodes.find((n) => n.id === nodeId)?.label ?? nodeId;
}

function evaluateOne(f: Funnel, c: Constraint): ConstraintResult {
  const sim = simulate(f);

  switch (c.kind) {
    case "budget_cap": {
      const actual = sim.totals.cost;
      const limit = c.limitMinor;
      const margin = limit > 0 ? (limit - actual) / limit : actual === 0 ? 1 : -1;
      return { id: c.id, kind: c.kind, label: labelOf(c), satisfied: margin >= 0, actual, limit, margin, severity: classify(margin) };
    }
    case "capacity_limit": {
      const node = sim.nodes[c.nodeId];
      const actual = node ? node.inflow : 0;
      const limit = c.maxUnits;
      const margin = limit > 0 ? (limit - actual) / limit : actual === 0 ? 1 : -1;
      const label = c.label ?? `${nodeLabel(f, c.nodeId)} capacity`;
      return { id: c.id, kind: c.kind, label, satisfied: margin >= 0, actual, limit, margin, severity: classify(margin) };
    }
    case "rate_limit": {
      const node = sim.nodes[c.nodeId];
      // a traffic node's own volume is what it EMITS, not its inflow (sources
      // have no inflow); sum across ports so the check works for any node kind.
      const actual = node ? Object.values(node.emissions).reduce((s, v) => s + (v ?? 0), 0) : 0;
      const limit = c.maxVisitors;
      const margin = limit > 0 ? (limit - actual) / limit : actual === 0 ? 1 : -1;
      const label = c.label ?? `${nodeLabel(f, c.nodeId)} volume`;
      return { id: c.id, kind: c.kind, label, satisfied: margin >= 0, actual, limit, margin, severity: classify(margin) };
    }
    case "min_threshold": {
      const { cost, buyers, revenue } = sim.totals;
      const actual = c.metric === "cpa" ? (buyers > 0 ? cost / buyers : 0) : (cost > 0 ? revenue / cost : revenue > 0 ? Infinity : 0);
      const limit = c.value;
      // "under": actual must stay <= limit. "over": actual must stay >= limit.
      const margin = c.direction === "under"
        ? (limit > 0 ? (limit - actual) / limit : actual === 0 ? 1 : -1)
        : (limit > 0 ? (actual - limit) / limit : actual >= 0 ? 1 : -1);
      const finiteMargin = Number.isFinite(margin) ? margin : 1;
      const label = c.label ?? `${c.metric.toUpperCase()} ${c.direction} ${limit}`;
      return { id: c.id, kind: c.kind, label, satisfied: finiteMargin >= 0, actual: Number.isFinite(actual) ? actual : Number.MAX_SAFE_INTEGER, limit, margin: finiteMargin, severity: classify(finiteMargin), metric: c.metric };
    }
  }
}

export function evaluateConstraints(funnel: Funnel, constraints: Constraint[]): ConstraintReport {
  const results = constraints.map((c) => evaluateOne(funnel, c));
  const violated = results.filter((r) => !r.satisfied);
  const worstSeverity: Severity = results.some((r) => r.severity === "violated")
    ? "violated"
    : results.some((r) => r.severity === "warning")
    ? "warning"
    : "ok";
  return { results, violated, allSatisfied: violated.length === 0, worstSeverity };
}

/** For solver-style search: keep only funnels that satisfy every constraint.
 *  Additive helper — does not modify solver.ts. */
export function filterViable(candidates: Funnel[], constraints: Constraint[]): Funnel[] {
  if (constraints.length === 0) return candidates;
  return candidates.filter((f) => evaluateConstraints(f, constraints).allSatisfied);
}
