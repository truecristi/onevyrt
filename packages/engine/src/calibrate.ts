/**
 * CALIBRATE: from observed ACTUAL values, back-solve the funnel's true rates and
 * propose corrections to the PLAN. Propose-only — nothing here mutates the plan;
 * applyProposals returns a NEW funnel, and correctedForecast simulates it so the
 * UI can show "what the funnel really produces at true rates" before anyone
 * commits. Invariant: after applying a conversion calibration, a re-simulation
 * reproduces the observed buyers.
 */
import type { Funnel, FunnelNode, NodeId, SimulationResult } from "./types.ts";
import type { Actuals } from "./actuals.ts";
import { simulate } from "./simulate.ts";

export type CalibField = "visitors" | "costPerVisitor" | "price" | "conversionRate";

export interface CalibProposal {
  nodeId: NodeId;
  kind: string;
  field: CalibField;
  unit: "count" | "minor" | "rate";
  planValue: number;
  proposedValue: number;
  basis: string; // human-readable reason
}

export interface CalibrationReport {
  proposals: CalibProposal[];
}

/** Build calibration proposals by comparing plan rates against what actuals imply. */
export function computeCalibration(funnel: Funnel, plan: SimulationResult, actuals: Actuals): CalibrationReport {
  const proposals: CalibProposal[] = [];

  for (const n of funnel.nodes) {
    const a = actuals[n.id];
    if (!a) continue;

    if (n.kind === "traffic") {
      if (a.visitors != null && a.visitors !== n.visitors) {
        proposals.push({ nodeId: n.id, kind: n.kind, field: "visitors", unit: "count",
          planValue: n.visitors, proposedValue: a.visitors, basis: `observed ${a.visitors} visitors` });
      }
      if (a.cost != null && a.visitors != null && a.visitors > 0) {
        const cpv = Math.round(a.cost / a.visitors);
        if (cpv !== n.costPerVisitor) {
          proposals.push({ nodeId: n.id, kind: n.kind, field: "costPerVisitor", unit: "minor",
            planValue: n.costPerVisitor, proposedValue: cpv, basis: `spend / visitors observed` });
        }
      }
    } else if (n.kind === "offer") {
      if (a.buyers != null && a.revenue != null && a.buyers > 0) {
        const price = Math.round(a.revenue / a.buyers);
        if (price !== n.price) {
          proposals.push({ nodeId: n.id, kind: n.kind, field: "price", unit: "minor",
            planValue: n.price, proposedValue: price, basis: `revenue / buyers observed` });
        }
      }
      if (a.buyers != null) {
        const inflow = plan.nodes[n.id]?.inflow ?? 0;
        if (inflow > 0) {
          const conv = Math.min(1, Math.max(0, a.buyers / inflow));
          if (Math.abs(conv - n.conversionRate) > 1e-9) {
            proposals.push({ nodeId: n.id, kind: n.kind, field: "conversionRate", unit: "rate",
              planValue: n.conversionRate, proposedValue: conv, basis: `buyers / arrivals observed` });
          }
        }
      }
    }
  }

  return { proposals };
}

/** Return a NEW funnel with the given proposals applied. Never mutates input. */
export function applyProposals(funnel: Funnel, proposals: CalibProposal[]): Funnel {
  const byNode = new Map<string, CalibProposal[]>();
  for (const p of proposals) {
    const list = byNode.get(p.nodeId) ?? [];
    list.push(p);
    byNode.set(p.nodeId, list);
  }
  const nodes = funnel.nodes.map((n): FunnelNode => {
    const ps = byNode.get(n.id);
    if (!ps) return n;
    const next = { ...n } as Record<string, unknown>;
    for (const p of ps) next[p.field] = p.proposedValue;
    return next as unknown as FunnelNode;
  });
  return { nodes, edges: funnel.edges };
}

/** Simulate the funnel with proposals applied — the "corrected forecast". */
export function correctedForecast(funnel: Funnel, proposals: CalibProposal[]): SimulationResult {
  return simulate(applyProposals(funnel, proposals));
}
