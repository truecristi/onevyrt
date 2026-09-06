import type { Minor } from "./money.ts";

export type NodeId = string;

/** A traffic CHANNEL. Emits `visitors + inflow` on its "out" port (people routed
 *  in are passed through, never dropped) and books `visitors * costPerVisitor` as
 *  cost — you are billed only for the visitors this node itself acquires. */
export interface TrafficNode {
  id: NodeId;
  kind: "traffic";
  label?: string;
  visitors: number;        // expected visitors (>= 0)
  costPerVisitor: Minor;   // minor units per visitor (>= 0)
  /** How this channel is billed. "perVisitor" (default) uses costPerVisitor;
   *  "flat" ignores it and books `flatCost` once, however many visitors arrive. */
  costModel?: "perVisitor" | "flat";
  /** Total spend for this channel when costModel === "flat", in minor units. */
  flatCost?: Minor;
  /** Flat operating expense booked at this node, in minor units. */
  expenseAmount?: Minor;
  /** 0..1 operating expense charged on this node's revenue. */
  expenseRate?: number;
  /** Days this node holds its population before releasing it downstream (e.g.
   *  a wait step or a webinar's replay window). Ignored by the profit/ratio
   *  simulation; used only by computeTimeline for time-to-conversion. */
  delayDays?: number;
}

/** A pass-through step (landing page, email, etc.). Emits inflow * passRate. */
export interface StepNode {
  id: NodeId;
  kind: "step";
  label?: string;
  passRate: number;        // 0..1
  /** Flat operating expense booked at this node, in minor units. */
  expenseAmount?: Minor;
  /** 0..1 operating expense charged on this node's revenue. */
  expenseRate?: number;
  /** Days this node holds its population before releasing it downstream (e.g.
   *  a wait step or a webinar's replay window). Ignored by the profit/ratio
   *  simulation; used only by computeTimeline for time-to-conversion. */
  delayDays?: number;
}

/** An offer / sale. buyers = inflow * conversionRate; revenue = buyers * price.
 *  The buyers proceed on the "out" port (e.g. into an upsell). */
/** One sellable version of an offer: its own price and its own economics. */
export interface Variant {
  id: string;
  name?: string;
  sku?: string;
  /** Price in minor units. */
  price: Minor;
  /** Share of this offer's buyers who take this variant (0..1). Shares are
   *  normalised across ACTIVE variants, so they need not sum to exactly 1. */
  share: number;
  unitCost?: Minor;
  refundRate?: number;
  merchantFeeRate?: number;
  /** Inactive variants are ignored entirely (kept for history). */
  active?: boolean;
}

export interface OfferNode {
  id: NodeId;
  kind: "offer";
  label?: string;
  conversionRate: number;  // 0..1
  price: Minor;            // minor units (>= 0)
  // optional economics — all default to 0 / no effect when omitted
  orderBumpRate?: number;  // 0..1 of buyers who take the bump
  orderBumpPrice?: Minor;
  upsellRate?: number;     // 0..1 of buyers who take the upsell
  upsellPrice?: Minor;
  recurringRate?: number;  // 0..1 of buyers who subscribe
  monthlyPrice?: Minor;    // monthly recurring price per subscriber
  churnRate?: number;      // 0..1 monthly churn; drives lifetime value
  // --- unit economics (all optional; omitted == no effect) ---
  /** Cost of goods per fulfilled (non-refunded) sale, in minor units. */
  unitCost?: Minor;
  /** 0..1 share of collected revenue refunded back to buyers. */
  refundRate?: number;
  /** 0..1 processor fee, charged on revenue kept after refunds. */
  merchantFeeRate?: number;
  /** Optional price ladder. When present with active variants, buyers are split
   *  across them by share and each variant uses its OWN price and economics,
   *  falling back to the node's values where a variant omits them. */
  variants?: Variant[];
  /** Flat operating expense booked at this node, in minor units. */
  expenseAmount?: Minor;
  /** 0..1 operating expense charged on this node's revenue. */
  expenseRate?: number;
  /** Days this node holds its population before releasing it downstream (e.g.
   *  a wait step or a webinar's replay window). Ignored by the profit/ratio
   *  simulation; used only by computeTimeline for time-to-conversion. */
  delayDays?: number;
}

/** A YES/NO branch. Emits inflow*yesRate on "yes", inflow*(1-yesRate) on "no". */
export interface SplitNode {
  id: NodeId;
  kind: "split";
  label?: string;
  yesRate: number;         // 0..1
  /** Flat operating expense booked at this node, in minor units. */
  expenseAmount?: Minor;
  /** 0..1 operating expense charged on this node's revenue. */
  expenseRate?: number;
  /** Days this node holds its population before releasing it downstream (e.g.
   *  a wait step or a webinar's replay window). Ignored by the profit/ratio
   *  simulation; used only by computeTimeline for time-to-conversion. */
  delayDays?: number;
}

export type FunnelNode = TrafficNode | StepNode | OfferNode | SplitNode;

export type Port = "out" | "yes" | "no";

export interface Edge {
  from: NodeId;
  to: NodeId;
  port?: Port;             // defaults to "out"
}

export interface Funnel {
  nodes: FunnelNode[];
  edges: Edge[];
  /** Scenario-wide operating expenses (software, staff, fulfilment...). */
  expenses?: {
    /** Flat cost for the whole scenario, in minor units. */
    amount?: Minor;
    /** 0..1 charged on total revenue across the funnel. */
    rate?: number;
  };
}

/** Per-node computed result. */
export interface NodeResult {
  id: NodeId;
  kind: FunnelNode["kind"];
  inflow: number;                     // total population arriving
  emissions: Partial<Record<Port, number>>; // population sent per port
  buyers: number;                     // > 0 only for offer nodes
  revenue: Minor;                     // one-time revenue (incl. bump + upsell)
  cost: Minor;                        // > 0 only for traffic nodes
  mrr?: Minor;                        // monthly recurring revenue (offer w/ recurring)
  ltv?: Minor;                        // lifetime value of this node's new subscribers
}

export interface SimulationResult {
  nodes: Record<NodeId, NodeResult>;
  order: NodeId[];                    // topological order used
  totals: {
    visitors: number;
    buyers: number;
    revenue: Minor;
    cost: Minor;
    grossProfit: Minor;              // revenue - cost
    mrr?: Minor;                     // total monthly recurring revenue
    ltv?: Minor;                     // total lifetime value of new subscribers
  };
}

export class FunnelError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FunnelError";
    this.code = code;
  }
}
