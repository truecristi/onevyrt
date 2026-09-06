/**
 * Small, self-contained pieces lifted out of the funnel-studio.tsx
 * god-component (audit maintainability / task #8, first extraction slice).
 * Pure types + one factory; no React, no hooks, no state — safe to share.
 */
import type { Node, Edge } from "@xyflow/react";
import type { RFNodeData } from "../../lib/funnel-map";
import { initialNodes, initialEdges } from "./FunnelCanvas";

/** Recurring-revenue rollup shown in the plan summary. */
export type RecurringSummary = {
  mrr: number; arr: number; ltv: number; subscribers: number;
  avgLtvPerSub: number | null; cac: number | null; ltvToCac: number | null;
  byNode: { nodeId: string; label: string; subscribers: number; mrr: number; ltv: number }[];
};

export interface WsMember { userId: string; role: "owner" | "manager" | "editor" | "viewer"; }
export interface Ws { id: string; name: string; ownerId: string; members: WsMember[]; createdAt: string; plan?: string; }

/** Default name for a fresh, never-named canvas. Autosave treats a funnel still
 *  on this name as an unsaved scratch draft and does NOT persist it to the
 *  library — otherwise it reappears the instant it's deleted. */
export const DEFAULT_FUNNEL_NAME = "Untitled funnel";

/** A fresh, deep-cloned copy of the starter canvas (so edits never mutate the
 *  shared initialNodes/initialEdges module constants). */
export function freshInitial(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: initialNodes.map((n) => ({ ...n, position: { ...n.position }, data: { ...(n.data as RFNodeData) } })),
    edges: initialEdges.map((e) => ({ ...e })),
  };
}
