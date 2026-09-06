/**
 * Governance: a lightweight, persistent record of risks a team has chosen to
 * track and their mitigation status — the audit trail already lives in the
 * Decision log (loop.ts) and revision snapshots (persist history); this adds
 * the one piece those don't cover: a register of identified risks that
 * outlives any single Risk Engine assessment. Pure and read-only; nothing
 * here computes risk, it only records what a human decided about it.
 */
export type RiskRegisterStatus = "open" | "mitigated" | "accepted";

export interface RiskRegisterEntry {
  id: string;
  createdAt: string;
  label: string;
  /** What the risk is, in the team's own words — often copied from a Risk
   *  Engine assumption/sensitivity at the moment it was tracked. */
  description: string;
  severity: "low" | "medium" | "high";
  status: RiskRegisterStatus;
  owner?: string;
  /** Free-text note on how it was mitigated or why it was accepted. */
  resolution?: string;
  linkedNodeId?: string;
  resolvedAt?: string;
}

export interface RiskRegisterSummary {
  total: number;
  open: number;
  mitigated: number;
  accepted: number;
}

export function summarizeRiskRegister(entries: RiskRegisterEntry[]): RiskRegisterSummary {
  const s: RiskRegisterSummary = { total: 0, open: 0, mitigated: 0, accepted: 0 };
  for (const e of entries) {
    s.total++;
    if (e.status === "open") s.open++;
    else if (e.status === "mitigated") s.mitigated++;
    else s.accepted++;
  }
  return s;
}
