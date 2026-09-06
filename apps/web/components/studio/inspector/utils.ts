/**
 * Inspector utility functions extracted from InspectorPanels.tsx
 * Helpers for node calculations and data transformations
 */

import type { Node } from "@xyflow/react";
import type { RFNodeData } from "../../../lib/funnel-map";
import type { Variant } from "@onevyrt/engine";

/**
 * Get UI configuration object from a node
 */
export function uiOf(node: Node): Record<string, string | number | boolean> {
  const u = (node.data as RFNodeData).ui;
  return (u && typeof u === "object"
    ? u
    : {}) as Record<string, string | number | boolean>;
}

/**
 * Get active variants (excluding deactivated ones)
 */
export function activeVariants(d: RFNodeData): Variant[] {
  return (d.variants ?? []).filter((v) => v.active !== false);
}

/**
 * Calculate weighted average price across active variants
 */
export function weightedPrice(d: RFNodeData): number {
  const live = activeVariants(d);
  const total = live.reduce((s, v) => s + v.share, 0);
  if (!live.length || total <= 0) return d.price ?? 0;
  return Math.round(
    live.reduce((s, v) => s + v.price * (v.share / total), 0)
  );
}

/**
 * Calculate net profit per sale after refunds, fees, and costs
 */
export function netPerSale(d: RFNodeData): number {
  const price = weightedPrice(d),
    rr = d.refundRate ?? 0,
    fee = d.merchantFeeRate ?? 0,
    uc = d.unitCost ?? 0;
  const kept = price * (1 - rr);
  return Math.round(kept - kept * fee - uc * (1 - rr));
}

/**
 * Approval status display configuration
 */
export const APPROVAL_COPY = {
  not_required: { label: "Not required", color: "var(--dim)" },
  pending: { label: "Pending", color: "#f59e0b" },
  approved: { label: "Approved", color: "#16a34a" },
  changes_requested: { label: "Changes requested", color: "#dc2626" },
};

/**
 * Integration status display configuration
 */
export const INTEGRATION_COPY = {
  planned: { label: "Planned", color: "var(--dim)" },
  manual: { label: "Manual", color: "#f59e0b" },
  connected: { label: "Connected", color: "#16a34a" },
};

/**
 * Theme color options for node styling
 */
export const THEME_COLOURS = [
  "none",
  "indigo",
  "emerald",
  "rose",
  "amber",
  "sky",
  "violet",
  "slate",
];
