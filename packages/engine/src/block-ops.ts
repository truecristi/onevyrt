/**
 * Block Operating System: turns an important canvas block into an
 * executable mini-runbook — purpose, setup, SOP, checklist, owner, KPIs,
 * evidence, approval and integration status — rather than just an
 * economics node. Deliberately does NOT duplicate assumptions, experiments,
 * risks or goals: those already exist as their own top-level registers
 * (assumptions.ts, experiments.ts, governance.ts, goals.ts) and already
 * link back to a node via `linkedNodeId`. A block's "Assumptions",
 * "Experiments", "Risks" and "Related goals" are computed by filtering
 * those existing registers for this node, not stored again here. Pure
 * data + pure helpers, no UI, no storage.
 */

/** "planned"/"manual"/"connected" per the product rule: never claim a live
 *  integration (GHL, ad platforms, CRMs, SMS) that doesn't actually exist. */
export type IntegrationStatus = "planned" | "manual" | "connected";
export type ApprovalStatus = "not_required" | "pending" | "approved" | "changes_requested";

export interface BlockOpsChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface BlockOpsKpi {
  id: string;
  name: string;
  target?: number;
  actual?: number;
  unit?: string;
}

export interface BlockOpsEntry {
  id: string;
  linkedNodeId: string;
  purpose?: string;
  requiredInputs?: string[];
  setupInstructions?: string;
  sop?: string;
  checklist: BlockOpsChecklistItem[];
  owner?: string;
  dueDate?: string;
  kpis: BlockOpsKpi[];
  evidenceLinks?: string[];
  approvalStatus: ApprovalStatus;
  automationOpportunities?: string;
  integrationStatus: IntegrationStatus;
  createdAt: string;
  updatedAt: string;
}

export function findBlockOps(entries: BlockOpsEntry[], nodeId: string): BlockOpsEntry | null {
  return entries.find((e) => e.linkedNodeId === nodeId) ?? null;
}

/** A block counts as "operationalised" once it has more than just the
 *  defaults — used to badge which canvas blocks still need setup versus
 *  which are just economics nodes with nothing filled in yet. */
export function isBlockOpsStarted(entry: BlockOpsEntry): boolean {
  return Boolean(
    entry.purpose?.trim() || entry.setupInstructions?.trim() || entry.sop?.trim() ||
    entry.owner?.trim() || entry.dueDate || entry.checklist.length || entry.kpis.length ||
    entry.evidenceLinks?.length || entry.automationOpportunities?.trim() ||
    entry.approvalStatus !== "not_required" || entry.integrationStatus !== "planned",
  );
}
