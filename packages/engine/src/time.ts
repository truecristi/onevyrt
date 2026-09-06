/**
 * Time engine: turns per-node `delayDays` into a timeline — how many days
 * from the first traffic click until population reaches each node, and a
 * buyer-weighted "time to conversion" for every offer. Pure and read-only;
 * nodes without a delayDays are assumed instant (0 days). A node's arrival
 * day is the latest of its inputs (population can't proceed until every
 * upstream path has delivered it).
 */
import type { Funnel, NodeId, SimulationResult } from "./types.ts";

export interface TimelineReport {
  daysFromStart: Record<NodeId, number>;
  offers: { nodeId: NodeId; daysToConvert: number }[];
  /** Buyer-weighted average days-to-convert across all offers; null with no buyers. */
  overallDaysToConvert: number | null;
}

export function computeTimeline(funnel: Funnel, sim: SimulationResult): TimelineReport {
  const delayOf = new Map<NodeId, number>();
  for (const n of funnel.nodes) delayOf.set(n.id, Math.max(0, (n as { delayDays?: number }).delayDays ?? 0));

  const incoming = new Map<NodeId, NodeId[]>();
  for (const n of funnel.nodes) incoming.set(n.id, []);
  for (const e of funnel.edges) incoming.get(e.to)?.push(e.from);

  const daysFromStart: Record<NodeId, number> = {};
  for (const id of sim.order) {
    const ins = incoming.get(id) ?? [];
    daysFromStart[id] = ins.length === 0
      ? 0
      : Math.max(...ins.map((from) => (daysFromStart[from] ?? 0) + (delayOf.get(from) ?? 0)));
  }

  const offers = funnel.nodes
    .filter((n) => n.kind === "offer")
    .map((n) => ({ nodeId: n.id, daysToConvert: daysFromStart[n.id] ?? 0 }));

  const totalBuyers = offers.reduce((sum, o) => sum + (sim.nodes[o.nodeId]?.buyers ?? 0), 0);
  const weighted = offers.reduce((sum, o) => sum + o.daysToConvert * (sim.nodes[o.nodeId]?.buyers ?? 0), 0);

  return {
    daysFromStart,
    offers,
    overallDaysToConvert: totalBuyers > 0 ? weighted / totalBuyers : null,
  };
}
