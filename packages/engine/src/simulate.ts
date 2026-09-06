import {
  type Funnel, type NodeId, type Port, type NodeResult,
  type SimulationResult,
} from "./types.ts";
import { priceOf, roundMinor, type Minor } from "./money.ts";
import { validateFunnel, topoOrder } from "./graph.ts";

/**
 * Deterministic funnel simulation.
 *
 * Population is carried as a real number (expected value) and is NOT rounded
 * mid-funnel — rounding people at each step compounds error badly. Money is the
 * only thing rounded, and only at the point a fractional buyer count meets an
 * integer price, using the documented banker's rounding in money.ts.
 *
 * Pure function: same funnel in -> identical result out. No Date, no random.
 */
export function simulate(funnel: Funnel, extraInflow?: Record<NodeId, number>): SimulationResult {
  validateFunnel(funnel);
  const order = topoOrder(funnel);

  const byId = new Map<NodeId, Funnel["nodes"][number]>();
  for (const n of funnel.nodes) byId.set(n.id, n);

  // inflow accumulator per node — normally starts at 0, but callers modeling
  // a feedback loop (see retargeting.ts) can seed a node with population that
  // arrived from outside this single-pass DAG walk.
  const inflow = new Map<NodeId, number>();
  for (const n of funnel.nodes) inflow.set(n.id, extraInflow?.[n.id] ?? 0);

  // outgoing edges grouped by (from, port)
  const out = new Map<NodeId, { to: NodeId; port: Port }[]>();
  for (const n of funnel.nodes) out.set(n.id, []);
  for (const e of funnel.edges) {
    out.get(e.from)!.push({ to: e.to, port: e.port ?? "out" });
  }

  const results: Record<NodeId, NodeResult> = {};

  let visitors = 0, totalBuyers = 0, totalRevenue: Minor = 0, totalCost: Minor = 0, totalMrr: Minor = 0, totalLtv: Minor = 0;

  for (const id of order) {
    const node = byId.get(id)!;
    const incoming = inflow.get(id)!;
    const emissions: Partial<Record<Port, number>> = {};
    let buyers = 0;
    let revenue: Minor = 0;
    let cost: Minor = 0;
    let mrr: Minor = 0;
    let ltv: Minor = 0;

    switch (node.kind) {
      case "traffic": {
        // A traffic node is a CHANNEL, not just a source: it emits the visitors it
        // generates itself PLUS anyone routed into it (e.g. traffic sent to a social
        // page). Population is never dropped. Cost is charged only on the visitors
        // this node acquires; people you already paid for upstream are not billed twice,
        // and totals.visitors counts each person once, at the node that introduced them.
        emissions.out = node.visitors + incoming;
        cost = node.costModel === "flat"
          ? roundMinor(node.flatCost ?? 0)
          : roundMinor(node.visitors * node.costPerVisitor);
        visitors += node.visitors;
        break;
      }
      case "step": {
        emissions.out = incoming * node.passRate;
        break;
      }
      case "offer": {
        buyers = incoming * node.conversionRate;
        const bumpTakers = buyers * (node.orderBumpRate ?? 0);
        const upsellTakers = buyers * (node.upsellRate ?? 0);
        const live = (node.variants ?? []).filter((v) => v.active !== false);
        const shareTotal = live.reduce((sum, v) => sum + v.share, 0);

        if (live.length > 0 && shareTotal > 0) {
          // Price ladder: split buyers by normalised share; each variant keeps its
          // own price and economics, falling back to the node's where omitted.
          for (const v of live) {
            const vBuyers = buyers * (v.share / shareTotal);
            const vCollected = priceOf(vBuyers, v.price);
            const vRefund = v.refundRate ?? node.refundRate ?? 0;
            const vKept = vCollected - roundMinor(vCollected * vRefund);
            revenue += vKept;
            cost += roundMinor(vKept * (v.merchantFeeRate ?? node.merchantFeeRate ?? 0))
                  + priceOf(vBuyers * (1 - vRefund), v.unitCost ?? node.unitCost ?? 0);
          }
          // bumps and upsells sit on top of the ladder, at the node's own rates
          const extra = priceOf(bumpTakers, node.orderBumpPrice ?? 0)
                      + priceOf(upsellTakers, node.upsellPrice ?? 0);
          const extraKept = extra - roundMinor(extra * (node.refundRate ?? 0));
          revenue += extraKept;
          cost += roundMinor(extraKept * (node.merchantFeeRate ?? 0));
        } else {
          const collected = priceOf(buyers, node.price)
                  + priceOf(bumpTakers, node.orderBumpPrice ?? 0)
                  + priceOf(upsellTakers, node.upsellPrice ?? 0);
          // Refunds hand money back: revenue is what is KEPT.
          const refundRate = node.refundRate ?? 0;
          revenue = collected - roundMinor(collected * refundRate);
          // Processor takes a cut of what is kept; COGS are paid on fulfilled sales only.
          cost = roundMinor(revenue * (node.merchantFeeRate ?? 0))
               + priceOf(buyers * (1 - refundRate), node.unitCost ?? 0);
        }
        const subscribers = buyers * (node.recurringRate ?? 0);
        mrr = priceOf(subscribers, node.monthlyPrice ?? 0);
        const churn = node.churnRate ?? 0;
        if (churn > 0 && (node.monthlyPrice ?? 0) > 0) {
          const ltvPerSub = roundMinor((node.monthlyPrice ?? 0) / churn); // avg lifetime = 1/churn months
          ltv = priceOf(subscribers, ltvPerSub);
        }
        emissions.out = buyers; // converters proceed downstream
        break;
      }
      case "split": {
        const yes = incoming * node.yesRate;
        emissions.yes = yes;
        emissions.no = incoming - yes; // conserve population exactly, no float drift
        break;
      }
    }

    // operating expenses booked at this node (flat + a share of its revenue)
    cost += roundMinor(node.expenseAmount ?? 0) + roundMinor(revenue * (node.expenseRate ?? 0));

    // push emissions to downstream nodes on matching ports
    for (const edge of out.get(id)!) {
      const amount = emissions[edge.port] ?? 0;
      inflow.set(edge.to, inflow.get(edge.to)! + amount);
    }

    totalBuyers += buyers;
    totalRevenue += revenue;
    totalCost += cost;
    totalMrr += mrr;
    totalLtv += ltv;

    results[id] = {
      id,
      kind: node.kind,
      inflow: incoming,
      emissions,
      buyers,
      revenue,
      cost,
      mrr,
      ltv,
    };
  }

  // scenario-wide operating expenses (not attributable to any single node)
  const scenarioExpense = roundMinor(funnel.expenses?.amount ?? 0)
                        + roundMinor(totalRevenue * (funnel.expenses?.rate ?? 0));
  totalCost += scenarioExpense;

  return {
    nodes: results,
    order,
    totals: {
      visitors,
      buyers: totalBuyers,
      revenue: totalRevenue,
      cost: totalCost,
      grossProfit: totalRevenue - totalCost,
      mrr: totalMrr,
      ltv: totalLtv,
    },
  };
}
