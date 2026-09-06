"use client";

import type { Node } from "@xyflow/react";
import { formatMoney, type ConstraintReport, type ConstraintKind, type ThresholdMetric } from "@onevyrt/engine";
import type { RFNodeData } from "../../lib/funnel-map";
import { ACCENT, barBtn, barGhost } from "../../lib/studio-ui";
import { GlassDrawer } from "./GlassDrawer";

export interface ConstraintDraft { kind: ConstraintKind; nodeId: string; metric: ThresholdMetric; direction: "under" | "over"; value: string }

export function ConstraintsPanel({
  nodes, funnelCurrency, constraintDraft, setConstraintDraft, constraintReport, addConstraint, removeConstraint, onClose,
}: {
  nodes: Node[];
  funnelCurrency: string;
  constraintDraft: ConstraintDraft;
  setConstraintDraft: (updater: (d: ConstraintDraft) => ConstraintDraft) => void;
  constraintReport: ConstraintReport | null;
  addConstraint: () => void;
  removeConstraint: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <GlassDrawer width={420} label="Hard limits" onClose={onClose}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>CONSTRAINTS</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Hard limits</div>
        </div>
        <button onClick={onClose} style={barGhost}>Close</button>
      </div>
      <div style={{ overflowY: "auto", padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, alignItems: "center" }}>
          <select value={constraintDraft.kind} onChange={(e) => setConstraintDraft((d) => ({ ...d, kind: e.target.value as ConstraintKind, nodeId: "" }))}
            style={{ background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 13 }}>
            <option value="budget_cap">Budget cap ({funnelCurrency})</option>
            <option value="capacity_limit">Capacity limit (units)</option>
            <option value="rate_limit">Rate limit (visitors)</option>
            <option value="min_threshold">CPA / ROAS threshold</option>
          </select>
          {(constraintDraft.kind === "capacity_limit" || constraintDraft.kind === "rate_limit") && (
            <select value={constraintDraft.nodeId} onChange={(e) => setConstraintDraft((d) => ({ ...d, nodeId: e.target.value }))}
              style={{ background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 13 }}>
              <option value="">Choose node…</option>
              {nodes.filter((n) => constraintDraft.kind === "rate_limit" ? (n.data as RFNodeData).kind === "traffic" : (n.data as RFNodeData).kind === "step" || (n.data as RFNodeData).kind === "offer")
                .map((n) => <option key={n.id} value={n.id}>{(n.data as RFNodeData).label || n.id}</option>)}
            </select>
          )}
          {constraintDraft.kind === "min_threshold" && (
            <>
              <select value={constraintDraft.metric} onChange={(e) => setConstraintDraft((d) => ({ ...d, metric: e.target.value as ThresholdMetric }))}
                style={{ background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 13 }}>
                <option value="cpa">CPA</option>
                <option value="roas">ROAS</option>
              </select>
              <select value={constraintDraft.direction} onChange={(e) => setConstraintDraft((d) => ({ ...d, direction: e.target.value as "under" | "over" }))}
                style={{ background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 13 }}>
                <option value="under">stay under</option>
                <option value="over">stay over</option>
              </select>
            </>
          )}
          <input value={constraintDraft.value} onChange={(e) => setConstraintDraft((d) => ({ ...d, value: e.target.value }))} placeholder="value"
            style={{ width: 84, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 13 }} />
          <button onClick={addConstraint} style={barBtn}>Add</button>
        </div>
        {constraintReport === null || constraintReport.results.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--dim)" }}>No constraints yet. Add a budget cap, capacity limit, rate limit, or CPA/ROAS threshold above.</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "8px 10px", borderRadius: 8,
              background: constraintReport.allSatisfied ? "#16a34a22" : constraintReport.worstSeverity === "violated" ? "#dc262622" : "#eab30822",
              border: `1px solid ${constraintReport.allSatisfied ? "#16a34a" : constraintReport.worstSeverity === "violated" ? "#dc2626" : "#eab308"}` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: constraintReport.allSatisfied ? "#16a34a" : constraintReport.worstSeverity === "violated" ? "#dc2626" : "#ca8a04" }}>
                {constraintReport.allSatisfied ? "All constraints satisfied" : `${constraintReport.violated.length} constraint${constraintReport.violated.length === 1 ? "" : "s"} violated`}
              </span>
            </div>
            {constraintReport.results.map((r) => (
              <div key={r.id} style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: "var(--surface2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: r.severity === "violated" ? "#dc2626" : r.severity === "warning" ? "#ca8a04" : "var(--text)" }}>
                    {r.severity === "violated" ? "✕" : r.severity === "warning" ? "⚠" : "✓"} {r.label}
                  </span>
                  <button onClick={() => removeConstraint(r.id)} style={{ ...barGhost, padding: "2px 8px", fontSize: 11 }}>Remove</button>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                  {r.kind === "budget_cap" ? `${formatMoney(r.actual, funnelCurrency)} of ${formatMoney(r.limit, funnelCurrency)} cap`
                    : r.kind === "min_threshold" && r.metric === "cpa" ? `${formatMoney(r.actual, funnelCurrency)} vs limit ${formatMoney(r.limit, funnelCurrency)}`
                    : r.kind === "min_threshold" ? `${(Math.round(r.actual * 100) / 100)}x vs limit ${r.limit}x`
                    : `${Math.round(r.actual)} of ${Math.round(r.limit)} limit`}
                  {" · "}{r.margin >= 0 ? `${Math.round(r.margin * 100)}% headroom` : `${Math.round(-r.margin * 100)}% over`}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </GlassDrawer>
  );
}
