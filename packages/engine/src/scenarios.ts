/**
 * Scenarios: compare "what-if" variants of a funnel against the base plan.
 * A Scenario is a named set of field overrides; applying it yields a NEW funnel
 * (never mutating the base), which we simulate and diff against the base totals.
 * Pure: same inputs -> same comparison.
 */
import { simulate } from "./simulate.ts";
import type { Funnel, NodeId, SimulationResult } from "./types.ts";
import type { Minor } from "./money.ts";

export interface ScenarioOverride {
  nodeId: NodeId;
  field: string;   // a numeric field on the node (e.g. "conversionRate", "price", "monthlyPrice")
  value: number;
}

export interface Scenario {
  id: string;
  name: string;
  overrides: ScenarioOverride[];
}

/** Return a new funnel with the scenario's overrides applied. Base is untouched. */
export function applyScenario(funnel: Funnel, scenario: Scenario): Funnel {
  const nodes = funnel.nodes.map((n) => {
    const ovs = scenario.overrides.filter((o) => o.nodeId === n.id);
    if (ovs.length === 0) return n;
    const copy = { ...n } as unknown as Record<string, unknown>;
    for (const o of ovs) copy[o.field] = o.value;
    return copy as unknown as Funnel["nodes"][number];
  });
  return { nodes, edges: funnel.edges };
}

export interface ScenarioDelta {
  revenue: Minor;
  grossProfit: Minor;
  mrr: Minor;
  buyers: number;
  cost: Minor;
}

export interface ScenarioResult {
  id: string;
  name: string;
  totals: SimulationResult["totals"];
  delta: ScenarioDelta;
}

export interface ScenarioComparison {
  base: SimulationResult["totals"];
  scenarios: ScenarioResult[];
}

/** Simulate the base and every scenario, returning totals + deltas vs base. */
export function compareScenarios(funnel: Funnel, scenarios: Scenario[]): ScenarioComparison {
  const base = simulate(funnel).totals;
  const results: ScenarioResult[] = scenarios.map((s) => {
    const totals = simulate(applyScenario(funnel, s)).totals;
    return {
      id: s.id,
      name: s.name,
      totals,
      delta: {
        revenue: totals.revenue - base.revenue,
        grossProfit: totals.grossProfit - base.grossProfit,
        mrr: (totals.mrr ?? 0) - (base.mrr ?? 0),
        buyers: totals.buyers - base.buyers,
        cost: totals.cost - base.cost,
      },
    };
  });
  return { base, scenarios: results };
}

export interface HeadToHeadSide {
  id: string;
  name: string;
  totals: SimulationResult["totals"];
}
export interface HeadToHead {
  a: HeadToHeadSide;
  b: HeadToHeadSide;
  /** B minus A across the compared metrics. Positive means B is higher. */
  delta: ScenarioDelta;
}

const BASE_ID = "__base__";

/** Resolve one side of an A/B by id — either the base plan or a saved
 *  scenario in the comparison. Returns null if the id matches neither. */
function sideOf(cmp: ScenarioComparison, id: string): HeadToHeadSide | null {
  if (id === BASE_ID) return { id: BASE_ID, name: "Base plan", totals: cmp.base };
  const s = cmp.scenarios.find((x) => x.id === id);
  return s ? { id: s.id, name: s.name, totals: s.totals } : null;
}

/** Put two sides of a comparison head-to-head. Either id may be the sentinel
 *  base id (exported as HEAD_TO_HEAD_BASE_ID) to compare a scenario against
 *  the base plan. `delta` is B − A, so a positive grossProfit means B wins.
 *  Returns null when either id can't be resolved. */
export function headToHead(cmp: ScenarioComparison, aId: string, bId: string): HeadToHead | null {
  const a = sideOf(cmp, aId);
  const b = sideOf(cmp, bId);
  if (!a || !b) return null;
  return {
    a,
    b,
    delta: {
      revenue: b.totals.revenue - a.totals.revenue,
      grossProfit: b.totals.grossProfit - a.totals.grossProfit,
      mrr: (b.totals.mrr ?? 0) - (a.totals.mrr ?? 0),
      buyers: b.totals.buyers - a.totals.buyers,
      cost: b.totals.cost - a.totals.cost,
    },
  };
}

/** The id to pass to headToHead for "the base plan" side. */
export const HEAD_TO_HEAD_BASE_ID = BASE_ID;
