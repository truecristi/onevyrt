import type { Funnel, NodeId } from "./types.ts";

/**
 * Step Explorer: "what comes before/after this node" — pure graph traversal
 * over the funnel's edges, no simulation involved. Answers the two questions
 * a user actually asks while staring at a node: what feeds it, and what does
 * it feed. Traffic/offer breakdowns are just ancestors/descendants filtered
 * by kind, since those are usually the two things worth knowing at a glance.
 */
export interface StepExplorerResult {
  ancestors: NodeId[];          // every node with a directed path INTO this node (excludes self)
  descendants: NodeId[];        // every node reachable FROM this node (excludes self)
  upstreamTrafficSources: NodeId[]; // ancestors that are traffic nodes
  downstreamOffers: NodeId[];       // descendants that are offer nodes
}

function reachable(adj: Map<NodeId, NodeId[]>, start: NodeId): NodeId[] {
  const seen = new Set<NodeId>();
  const queue = [...(adj.get(start) ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(adj.get(id) ?? []));
  }
  return [...seen];
}

export function exploreStep(funnel: Funnel, nodeId: NodeId): StepExplorerResult {
  const forward = new Map<NodeId, NodeId[]>();
  const backward = new Map<NodeId, NodeId[]>();
  for (const n of funnel.nodes) { forward.set(n.id, []); backward.set(n.id, []); }
  for (const e of funnel.edges) {
    forward.get(e.from)?.push(e.to);
    backward.get(e.to)?.push(e.from);
  }

  const ancestors = reachable(backward, nodeId);
  const descendants = reachable(forward, nodeId);
  const kindOf = new Map(funnel.nodes.map((n) => [n.id, n.kind] as const));

  return {
    ancestors,
    descendants,
    upstreamTrafficSources: ancestors.filter((id) => kindOf.get(id) === "traffic"),
    downstreamOffers: descendants.filter((id) => kindOf.get(id) === "offer"),
  };
}
