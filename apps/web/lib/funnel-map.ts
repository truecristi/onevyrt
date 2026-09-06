import type { Funnel, FunnelNode, Port, Variant } from "@onevyrt/engine";

/** Data carried on each React Flow node. Only the fields relevant to a node's
 *  kind are used; the rest stay undefined. */
export interface RFNodeData {
  kind: FunnelNode["kind"];
  label: string;
  visitors?: number;
  costPerVisitor?: number; // minor units
  passRate?: number;       // 0..1
  conversionRate?: number; // 0..1
  price?: number;          // minor units
  yesRate?: number;        // 0..1
  orderBumpRate?: number;
  orderBumpPrice?: number;
  upsellRate?: number;
  upsellPrice?: number;
  recurringRate?: number;
  monthlyPrice?: number;
  churnRate?: number;
  unitCost?: number;
  refundRate?: number;
  merchantFeeRate?: number;
  variants?: Variant[];
  flatCost?: number;
  costModel?: "perVisitor" | "flat";
  expenseAmount?: number;
  expenseRate?: number;
  delayDays?: number;
  [key: string]: unknown;  // React Flow requires an index signature on node data
}

export interface RFNodeLike {
  id: string;
  data: RFNodeData;
}
export interface RFEdgeLike {
  source: string;
  target: string;
  sourceHandle?: string | null;
}

/** Build an engine Funnel from the current canvas graph. Pure + total. */
export function toFunnel(nodes: RFNodeLike[], edges: RFEdgeLike[]): Funnel {
  const fnodes: FunnelNode[] = nodes.map((n): FunnelNode => {
    const d = n.data;
    switch (d.kind) {
      case "traffic":
        return { id: n.id, kind: "traffic", label: d.label,
                 visitors: d.visitors ?? 0, costPerVisitor: d.costPerVisitor ?? 0,
                 costModel: d.costModel, flatCost: d.flatCost,
                 expenseAmount: d.expenseAmount, expenseRate: d.expenseRate, delayDays: d.delayDays };
      case "step":
        return { id: n.id, kind: "step", label: d.label, passRate: d.passRate ?? 0,
                 expenseAmount: d.expenseAmount, expenseRate: d.expenseRate, delayDays: d.delayDays };
      case "offer":
        return { id: n.id, kind: "offer", label: d.label,
                 conversionRate: d.conversionRate ?? 0, price: d.price ?? 0,
                 orderBumpRate: d.orderBumpRate, orderBumpPrice: d.orderBumpPrice,
                 upsellRate: d.upsellRate, upsellPrice: d.upsellPrice,
                 recurringRate: d.recurringRate, monthlyPrice: d.monthlyPrice, churnRate: d.churnRate,
                 unitCost: d.unitCost, refundRate: d.refundRate, merchantFeeRate: d.merchantFeeRate,
                 variants: d.variants,
                 expenseAmount: d.expenseAmount, expenseRate: d.expenseRate, delayDays: d.delayDays };
      case "split":
        return { id: n.id, kind: "split", label: d.label, yesRate: d.yesRate ?? 0,
                 expenseAmount: d.expenseAmount, expenseRate: d.expenseRate, delayDays: d.delayDays };
    }
  });

  const fedges = edges.map((e) => {
    const port: Port =
      e.sourceHandle === "yes" ? "yes" : e.sourceHandle === "no" ? "no" : "out";
    return { from: e.source, to: e.target, port };
  });

  return { nodes: fnodes, edges: fedges };
}

/** Default numeric fields for a freshly created node of a given kind. */
export function defaultData(kind: FunnelNode["kind"], label: string): RFNodeData {
  switch (kind) {
    case "traffic": return { kind, label, visitors: 1000, costPerVisitor: 200 };
    case "step":    return { kind, label, passRate: 0.4 };
    case "offer":   return { kind, label, conversionRate: 0.1, price: 9700 };
    case "split":   return { kind, label, yesRate: 0.7 };
  }
}
