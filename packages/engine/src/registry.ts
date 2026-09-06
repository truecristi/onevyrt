/**
 * Node Capability Registry (Ch.017): every node kind declares what it can do.
 * Single source of truth for a kind's editable fields, canvas colour, display
 * label, and capability flags. The palette, inspector, scenario builder, and
 * Goal Solver lever-picker all read from here instead of duplicating specs.
 * Adding a field or kind here propagates everywhere.
 */
import type { FunnelNode } from "./types.ts";

export type FieldUnit = "count" | "rate" | "money";
export interface FieldDef { key: string; label: string; unit: FieldUnit; }

export interface NodeCapability {
  kind: FunnelNode["kind"];
  label: string;
  color: string;
  fields: FieldDef[];              // editable numeric fields (authoritative)
  can: {
    emitTraffic: boolean;          // is a population source
    convert: boolean;              // has a conversion rate
    charge: boolean;               // produces revenue
    recur: boolean;                // supports recurring / MRR / churn
    split: boolean;                // routes population across branches
  };
}

export const NODE_REGISTRY: Record<FunnelNode["kind"], NodeCapability> = {
  traffic: {
    kind: "traffic", label: "Traffic", color: "#3b82f6",
    fields: [
      { key: "visitors", label: "Visitors", unit: "count" },
      { key: "costPerVisitor", label: "Cost/visitor ($)", unit: "money" },
      { key: "flatCost", label: "Flat traffic cost ($)", unit: "money" },
      { key: "expenseAmount", label: "Node expense ($)", unit: "money" },
      { key: "expenseRate", label: "Node expense (%)", unit: "rate" },
    ],
    can: { emitTraffic: true, convert: false, charge: false, recur: false, split: false },
  },
  step: {
    kind: "step", label: "Step", color: "#8b5cf6",
    fields: [
      { key: "passRate", label: "Pass rate (%)", unit: "rate" },
      { key: "expenseAmount", label: "Node expense ($)", unit: "money" },
      { key: "expenseRate", label: "Node expense (%)", unit: "rate" },
    ],
    can: { emitTraffic: false, convert: false, charge: false, recur: false, split: false },
  },
  offer: {
    kind: "offer", label: "Offer", color: "#22c55e",
    fields: [
      { key: "conversionRate", label: "Conversion (%)", unit: "rate" },
      { key: "price", label: "Price ($)", unit: "money" },
      { key: "orderBumpRate", label: "Bump rate (%)", unit: "rate" },
      { key: "orderBumpPrice", label: "Bump price ($)", unit: "money" },
      { key: "upsellRate", label: "Upsell rate (%)", unit: "rate" },
      { key: "upsellPrice", label: "Upsell price ($)", unit: "money" },
      { key: "recurringRate", label: "Recurring (%)", unit: "rate" },
      { key: "monthlyPrice", label: "Monthly ($)", unit: "money" },
      { key: "churnRate", label: "Monthly churn (%)", unit: "rate" },
      { key: "unitCost", label: "Unit cost ($)", unit: "money" },
      { key: "refundRate", label: "Refund rate (%)", unit: "rate" },
      { key: "merchantFeeRate", label: "Merchant fee (%)", unit: "rate" },
      { key: "expenseAmount", label: "Node expense ($)", unit: "money" },
      { key: "expenseRate", label: "Node expense (%)", unit: "rate" },
    ],
    can: { emitTraffic: false, convert: true, charge: true, recur: true, split: false },
  },
  split: {
    kind: "split", label: "Split", color: "#f59e0b",
    fields: [
      { key: "yesRate", label: "Yes rate (%)", unit: "rate" },
      { key: "expenseAmount", label: "Node expense ($)", unit: "money" },
      { key: "expenseRate", label: "Node expense (%)", unit: "rate" },
    ],
    can: { emitTraffic: false, convert: false, charge: false, recur: false, split: true },
  },
};

export function capabilityOf(kind: string): NodeCapability | undefined {
  return NODE_REGISTRY[kind as FunnelNode["kind"]];
}
export function fieldsFor(kind: string): FieldDef[] {
  return capabilityOf(kind)?.fields ?? [];
}
export function allKinds(): FunnelNode["kind"][] {
  return Object.keys(NODE_REGISTRY) as FunnelNode["kind"][];
}
