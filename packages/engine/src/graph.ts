import { type Funnel, type NodeId, FunnelError } from "./types.ts";

/** Validate structural integrity before simulation. Throws FunnelError with a
 *  precise code so callers (and the UI) can react without string-sniffing. */
export function validateFunnel(funnel: Funnel): void {
  const inRange = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
  const ids = new Set<NodeId>();
  for (const n of funnel.nodes) {
    if (ids.has(n.id)) {
      throw new FunnelError("DUPLICATE_NODE", `Duplicate node id: ${n.id}`);
    }
    ids.add(n.id);

    switch (n.kind) {
      case "traffic":
        if (!(n.visitors >= 0)) throw new FunnelError("BAD_VISITORS", `${n.id}: visitors must be >= 0`);
        if (!(n.costPerVisitor >= 0)) throw new FunnelError("BAD_COST", `${n.id}: costPerVisitor must be >= 0`);
        if (n.flatCost != null && !(n.flatCost >= 0)) throw new FunnelError("BAD_COST", `${n.id}: flatCost must be >= 0`);
        break;
      case "step":
        if (!inRange(n.passRate)) throw new FunnelError("BAD_RATE", `${n.id}: passRate must be 0..1`);
        break;
      case "offer":
        if (!inRange(n.conversionRate)) throw new FunnelError("BAD_RATE", `${n.id}: conversionRate must be 0..1`);
        if (!(n.price >= 0)) throw new FunnelError("BAD_PRICE", `${n.id}: price must be >= 0`);
        if (n.refundRate != null && !inRange(n.refundRate)) throw new FunnelError("BAD_RATE", `${n.id}: refundRate must be 0..1`);
        if (n.merchantFeeRate != null && !inRange(n.merchantFeeRate)) throw new FunnelError("BAD_RATE", `${n.id}: merchantFeeRate must be 0..1`);
        if (n.unitCost != null && !(n.unitCost >= 0)) throw new FunnelError("BAD_COST", `${n.id}: unitCost must be >= 0`);
        if (n.variants) {
          const ids = new Set<string>();
          for (const v of n.variants) {
            if (!v.id) throw new FunnelError("BAD_VARIANT", `${n.id}: every variant needs an id`);
            if (ids.has(v.id)) throw new FunnelError("BAD_VARIANT", `${n.id}: duplicate variant id ${v.id}`);
            ids.add(v.id);
            if (!(v.price >= 0)) throw new FunnelError("BAD_PRICE", `${n.id}/${v.id}: price must be >= 0`);
            if (!inRange(v.share)) throw new FunnelError("BAD_RATE", `${n.id}/${v.id}: share must be 0..1`);
            if (v.refundRate != null && !inRange(v.refundRate)) throw new FunnelError("BAD_RATE", `${n.id}/${v.id}: refundRate must be 0..1`);
            if (v.merchantFeeRate != null && !inRange(v.merchantFeeRate)) throw new FunnelError("BAD_RATE", `${n.id}/${v.id}: merchantFeeRate must be 0..1`);
            if (v.unitCost != null && !(v.unitCost >= 0)) throw new FunnelError("BAD_COST", `${n.id}/${v.id}: unitCost must be >= 0`);
          }
          const live = n.variants.filter((v) => v.active !== false);
          if (live.length && live.every((v) => v.share === 0)) throw new FunnelError("BAD_VARIANT", `${n.id}: active variants cannot all have 0 share`);
        }
        break;
      case "split":
        if (!inRange(n.yesRate)) throw new FunnelError("BAD_RATE", `${n.id}: yesRate must be 0..1`);
        break;
    }
  }

  for (const n of funnel.nodes) {
    if (n.expenseRate != null && !inRange(n.expenseRate)) throw new FunnelError("BAD_RATE", `${n.id}: expenseRate must be 0..1`);
    if (n.expenseAmount != null && !(n.expenseAmount >= 0)) throw new FunnelError("BAD_COST", `${n.id}: expenseAmount must be >= 0`);
  }
  if (funnel.expenses) {
    if (funnel.expenses.rate != null && !inRange(funnel.expenses.rate)) throw new FunnelError("BAD_RATE", "scenario expenses.rate must be 0..1");
    if (funnel.expenses.amount != null && !(funnel.expenses.amount >= 0)) throw new FunnelError("BAD_COST", "scenario expenses.amount must be >= 0");
  }

  for (const e of funnel.edges) {
    if (!ids.has(e.from)) throw new FunnelError("EDGE_FROM_MISSING", `Edge from unknown node: ${e.from}`);
    if (!ids.has(e.to)) throw new FunnelError("EDGE_TO_MISSING", `Edge to unknown node: ${e.to}`);
  }
}

/** Kahn topological sort. Throws FunnelError("CYCLE") if the graph is not a DAG
 *  (feedback loops — retargeting/reinvestment — are a later engine milestone,
 *  so we fail loudly rather than loop forever). */
export function topoOrder(funnel: Funnel): NodeId[] {
  const indeg = new Map<NodeId, number>();
  const adj = new Map<NodeId, NodeId[]>();
  for (const n of funnel.nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of funnel.edges) {
    adj.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }

  const queue: NodeId[] = [];
  for (const [id, d] of indeg) if (d === 0) queue.push(id);
  queue.sort(); // stable, deterministic ordering among equal-indegree nodes

  const order: NodeId[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    const next: NodeId[] = [];
    for (const m of adj.get(id)!) {
      indeg.set(m, indeg.get(m)! - 1);
      if (indeg.get(m) === 0) next.push(m);
    }
    next.sort();
    queue.push(...next);
  }

  if (order.length !== funnel.nodes.length) {
    throw new FunnelError("CYCLE", "Funnel contains a cycle; loops are not yet supported.");
  }
  return order;
}
