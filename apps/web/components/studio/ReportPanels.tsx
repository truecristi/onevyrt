"use client";

import { useState, type ReactNode } from "react";
import {
  computeVariance, computeCalibration, type CalibProposal,
  type Decision, type Confidence, type FunnelReport,
} from "@onevyrt/engine";
import { barBtn, barGhost, money, num, signedMoney, signedPct } from "../../lib/studio-ui";
import { promptDialog } from "../Modal";

export function VarianceList({ variance, labelOf }: { variance: ReturnType<typeof computeVariance> | null; labelOf: Record<string, string> }) {
  if (!variance) return <div style={{ color: "var(--dim)", fontSize: 13 }}>No actuals yet. Switch to ACTUAL, enter observed numbers on traffic/offer nodes, then come back here.</div>;
  if (variance.ranked.length === 0) return <div style={{ color: "var(--dim)", fontSize: 13 }}>No node-level actuals to compare.</div>;
  return (
    <div>
      {variance.ranked.map((v) => {
        const c = v.leak ? "#f87171" : "#4ade80";
        return (
          <div key={v.nodeId} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{labelOf[v.nodeId] ?? v.nodeId}</div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>{v.metric} {v.pctOffPlan != null ? signedPct(v.pctOffPlan) : "—"}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{signedMoney(v.profitImpact)}</div>
          </div>
        );
      })}
      {/* The part of the gap the per-node attribution can't explain — offer
          variable costs (COGS/fees) and operating expenses, which actuals don't
          record per node. Shown so the node impacts + this always reconcile to
          the profit gap instead of leaving a silent residual. */}
      {variance.unexplained !== 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Other (offer costs &amp; expenses)</div>
            <div style={{ fontSize: 11, color: "var(--dim)" }}>not tracked per node</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: variance.unexplained < 0 ? "#f87171" : "#4ade80" }}>{signedMoney(variance.unexplained)}</div>
        </div>
      )}
    </div>
  );
}

export function CalibrateList({ calibration, labelOf, applyProposal, applyAll, revert, hasSnapshot }: {
  calibration: ReturnType<typeof computeCalibration> | null;
  labelOf: Record<string, string>;
  applyProposal: (p: CalibProposal) => void;
  applyAll: () => void;
  revert: () => void;
  hasSnapshot: boolean;
}) {
  if (!calibration || calibration.proposals.length === 0)
    return <div style={{ color: "var(--dim)", fontSize: 13 }}>No calibration proposals. Enter observed numbers in ACTUAL mode that differ from plan, then return here.</div>;

  const fmt = (unit: CalibProposal["unit"], v: number) =>
    unit === "minor" ? money(v) : unit === "rate" ? `${(v * 100).toFixed(1)}%` : v.toLocaleString();
  const fieldLabel: Record<string, string> = {
    visitors: "Visitors", costPerVisitor: "Cost / visitor", price: "Price", conversionRate: "Conversion rate",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={applyAll} style={barBtn}>Apply all</button>
        <button onClick={revert} disabled={!hasSnapshot}
          style={{ ...barGhost, opacity: hasSnapshot ? 1 : 0.5, cursor: hasSnapshot ? "pointer" : "default" }}>Revert</button>
      </div>
      {calibration.proposals.map((p, i) => (
        <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{labelOf[p.nodeId] ?? p.nodeId}</div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>{fieldLabel[p.field] ?? p.field}</div>
            </div>
            <button onClick={() => applyProposal(p)} style={barBtn}>Apply</button>
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            <span style={{ color: "var(--dim)" }}>{fmt(p.unit, p.planValue)}</span>
            <span style={{ color: "var(--dim)" }}> {"→"} </span>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>{fmt(p.unit, p.proposedValue)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export const OUTCOME_COLOR: Record<string, string> = { hit: "#4ade80", partial: "#f59e0b", missed: "#f87171", inconclusive: "var(--muted)" };

export function TextRow({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label style={{ display: "block", marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", marginTop: 3, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 8px", fontSize: 13 }} />
    </label>
  );
}

export function DecidePanel({ decisions, biggestLeakId, labelOf, onAdd, onMeasure, onDelete, onApprove, onRevokeApproval }: {
  decisions: Decision[];
  biggestLeakId?: string;
  labelOf: Record<string, string>;
  onAdd: (d: Omit<Decision, "id" | "createdAt" | "status" | "measurement">) => void;
  onMeasure: (id: string, m: { baseline: number; expected: number; observed: number; learning: string }) => void;
  onDelete: (id: string) => void;
  onApprove: (id: string, approvedBy: string) => void;
  onRevokeApproval: (id: string) => void;
}) {
  const empty = { problem: "", hypothesis: "", move: "", reason: "", expectedImpact: "", confidence: "medium" as Confidence, owner: "", dueDate: "", link: false };
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState(empty);
  function set<K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) { setF((prev) => ({ ...prev, [k]: v })); }

  const submit = () => {
    if (!f.move.trim()) return;
    onAdd({
      problem: f.problem, hypothesis: f.hypothesis, move: f.move, reason: f.reason,
      expectedImpact: f.expectedImpact, confidence: f.confidence, owner: f.owner, dueDate: f.dueDate,
      linkedNodeId: f.link && biggestLeakId ? biggestLeakId : undefined,
    });
    setF(empty); setShowForm(false);
  };

  return (
    <div>
      <button onClick={() => setShowForm((v) => !v)} style={{ ...barBtn, width: "100%", marginBottom: 10 }}>
        {showForm ? "Close form" : "+ New decision"}
      </button>

      {showForm && (
        <div style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <TextRow label="Move (what you'll change)" value={f.move} onChange={(v) => set("move", v)} placeholder="Drop price 10%" />
          <TextRow label="Problem" value={f.problem} onChange={(v) => set("problem", v)} placeholder="Checkout conversion low" />
          <TextRow label="Hypothesis" value={f.hypothesis} onChange={(v) => set("hypothesis", v)} placeholder="Price is the blocker" />
          <TextRow label="Expected impact" value={f.expectedImpact} onChange={(v) => set("expectedImpact", v)} placeholder="+8 buyers / mo" />
          <TextRow label="Reason" value={f.reason} onChange={(v) => set("reason", v)} />
          <TextRow label="Owner" value={f.owner} onChange={(v) => set("owner", v)} />
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Confidence</span>
            <select value={f.confidence} onChange={(e) => set("confidence", e.target.value as Confidence)}
              style={{ width: "100%", marginTop: 3, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 8px", fontSize: 13 }}>
              <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
            </select>
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Due date</span>
            <input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)}
              style={{ width: "100%", marginTop: 3, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 8px", fontSize: 13 }} />
          </label>
          {biggestLeakId && (
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
              <input type="checkbox" checked={f.link} onChange={(e) => set("link", e.target.checked)} />
              Link to biggest leak ({labelOf[biggestLeakId] ?? biggestLeakId})
            </label>
          )}
          <button onClick={submit} style={{ ...barBtn, width: "100%" }}>Save decision</button>
        </div>
      )}

      {decisions.length === 0 ? (
        <div style={{ color: "var(--dim)", fontSize: 13 }}>No decisions yet. Log a change you plan to make; measure it later to see if it worked.</div>
      ) : (
        decisions.map((d) => <DecisionCard key={d.id} d={d} labelOf={labelOf} onMeasure={onMeasure} onDelete={onDelete} onApprove={onApprove} onRevokeApproval={onRevokeApproval} />)
      )}
    </div>
  );
}

function DecisionCard({ d, labelOf, onMeasure, onDelete, onApprove, onRevokeApproval }: {
  d: Decision;
  labelOf: Record<string, string>;
  onMeasure: (id: string, m: { baseline: number; expected: number; observed: number; learning: string }) => void;
  onDelete: (id: string) => void;
  onApprove: (id: string, approvedBy: string) => void;
  onRevokeApproval: (id: string) => void;
}) {
  const [measuring, setMeasuring] = useState(false);
  const [m, setM] = useState({ baseline: "", expected: "", observed: "", learning: "" });
  const commit = () => {
    onMeasure(d.id, { baseline: parseFloat(m.baseline) || 0, expected: parseFloat(m.expected) || 0, observed: parseFloat(m.observed) || 0, learning: m.learning });
    setMeasuring(false);
  };
  const oc = d.measurement?.outcome;
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{d.move || "(untitled move)"}</div>
          {d.problem && <div style={{ fontSize: 11, color: "var(--dim)" }}>{d.problem}</div>}
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
            {d.confidence} conf{d.owner ? ` · ${d.owner}` : ""}{d.dueDate ? ` · due ${d.dueDate}` : ""}
            {d.linkedNodeId ? ` · → ${labelOf[d.linkedNodeId] ?? d.linkedNodeId}` : ""}
          </div>
        </div>
        {d.status === "measured" && oc ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: OUTCOME_COLOR[oc], border: `1px solid ${OUTCOME_COLOR[oc]}`, borderRadius: 6, padding: "2px 7px", textTransform: "uppercase" }}>{oc}</span>
        ) : (
          <span style={{ fontSize: 11, color: "#f59e0b", border: "1px solid #f59e0b", borderRadius: 6, padding: "2px 7px" }}>OPEN</span>
        )}
      </div>

      {d.expectedImpact && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>expected: {d.expectedImpact}</div>}

      <div style={{ marginTop: 6 }}>
        {d.approvedBy ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ color: "#16a34a", fontWeight: 700 }}>{"✓ Approved"}</span>
            <span style={{ color: "var(--dim)" }}>by {d.approvedBy}{d.approvedAt ? ` · ${new Date(d.approvedAt).toLocaleDateString()}` : ""}</span>
            <button onClick={() => onRevokeApproval(d.id)} style={{ ...barGhost, padding: "1px 6px", fontSize: 11 }}>Revoke</button>
          </div>
        ) : (
          <button onClick={async () => { const who = await promptDialog({ title: "Approve this report", message: "Approve as (name or email):", placeholder: "name or email", confirmLabel: "Approve" }); if (who) onApprove(d.id, who); }}
            style={{ ...barGhost, padding: "2px 8px", fontSize: 11 }}>{"✓ Approve"}</button>
        )}
      </div>

      {d.status === "measured" && d.measurement && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          baseline {d.measurement.baseline} → expected {d.measurement.expected} → observed <span style={{ color: "var(--text)", fontWeight: 500 }}>{d.measurement.observed}</span>
          {d.measurement.learning && <div style={{ color: "var(--dim)", marginTop: 2 }}>{d.measurement.learning}</div>}
        </div>
      )}

      {d.status === "open" && (
        <div style={{ marginTop: 6 }}>
          {!measuring ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setMeasuring(true)} style={barBtn}>Measure</button>
              <button onClick={() => onDelete(d.id)} style={barGhost}>Delete</button>
            </div>
          ) : (
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" placeholder="baseline" value={m.baseline} onChange={(e) => setM({ ...m, baseline: e.target.value })} style={{ width: "33%", background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 6px", fontSize: 13 }} />
                <input type="number" placeholder="expected" value={m.expected} onChange={(e) => setM({ ...m, expected: e.target.value })} style={{ width: "33%", background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 6px", fontSize: 13 }} />
                <input type="number" placeholder="observed" value={m.observed} onChange={(e) => setM({ ...m, observed: e.target.value })} style={{ width: "33%", background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 6px", fontSize: 13 }} />
              </div>
              <input placeholder="what you learned" value={m.learning} onChange={(e) => setM({ ...m, learning: e.target.value })} style={{ width: "100%", marginTop: 6, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 8px", fontSize: 13 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button onClick={commit} style={barBtn}>Close decision</button>
                <button onClick={() => setMeasuring(false)} style={barGhost}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, letterSpacing: 0.6, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function RRow({ left, mid, right, rightColor }: { left: string; mid: string; right: string; rightColor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{left}</div>
      <div style={{ fontSize: 13, color: "var(--dim)", flex: 1, textAlign: "center" }}>{mid}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: rightColor }}>{right}</div>
    </div>
  );
}

export function ReportView({ report, onExport, onExportCsv, onExportPdf, onExportClientSummary, onPrint }: { report: FunnelReport | null; onExport: () => void; onExportCsv: () => void; onExportPdf: () => void; onExportClientSummary: () => void; onPrint: () => void }) {
  const [view, setView] = useState<"internal" | "client">("internal");
  if (!report) return <div style={{ padding: 24, color: "var(--dim)" }}>Build a funnel to generate a report.</div>;
  const h = report.headline;
  const fmtProp = (unit: CalibProposal["unit"], v: number) => (unit === "minor" ? money(v) : unit === "rate" ? `${(v * 100).toFixed(1)}%` : num(v));
  const card = (k: string, v: string, c = "var(--text)") => (
    <div key={k} style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 10, padding: "10px 16px", minWidth: 130 }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{k}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: c }}>{v}</div>
    </div>
  );
  const onTrack = h.profitGap == null ? null : h.profitGap >= 0;
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{report.name}</div>
          <div style={{ fontSize: 13, color: "var(--dim)" }}>Generated {new Date(report.generatedAt).toLocaleString()}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 8, padding: 2 }}>
            <button onClick={() => setView("internal")} style={{ ...barGhost, border: "none", background: view === "internal" ? "var(--surface)" : "transparent", fontWeight: view === "internal" ? 700 : 400 }}>Internal</button>
            <button onClick={() => setView("client")} style={{ ...barGhost, border: "none", background: view === "client" ? "var(--surface)" : "transparent", fontWeight: view === "client" ? 700 : 400 }}>Client view</button>
          </div>
          {view === "internal" ? (<>
            <button onClick={onExport} style={barBtn}>Export HTML</button>
            <button onClick={onExportCsv} style={barBtn}>Export CSV</button>
            <button onClick={onExportPdf} style={barBtn}>Export PDF</button>
            <button onClick={onPrint} style={barBtn}>Print</button>
          </>) : (
            <button onClick={onExportClientSummary} style={barBtn}>Export client summary</button>
          )}
        </div>
      </div>

      {view === "client" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, marginBottom: 20,
            background: onTrack == null ? "var(--surface2)" : onTrack ? "#16a34a18" : "#dc262618",
            border: `1px solid ${onTrack == null ? "var(--border2)" : onTrack ? "#16a34a" : "#dc2626"}` }}>
            <span style={{ fontSize: 16 }}>{onTrack == null ? "—" : onTrack ? "✓" : "⚠"}</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {onTrack == null ? "This funnel's plan is set — no results recorded yet." : onTrack ? "This funnel is beating plan." : "This funnel is behind plan — see below."}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
            {card("Plan Profit", money(h.planProfit))}
            {h.actualProfit != null && card("Actual Profit", money(h.actualProfit), h.actualProfit >= h.planProfit ? "#4ade80" : "#f87171")}
            {h.correctedProfit != null && card("Updated Forecast", money(h.correctedProfit), "#4ade80")}
          </div>
          <RSection title="What's been decided">
            {report.decisions.items.length === 0 ? (
              <div style={{ color: "var(--dim)", fontSize: 13 }}>No decisions logged yet.</div>
            ) : (
              report.decisions.items.map((d) => (
                <RRow key={d.id} left={d.move || "(untitled)"} mid={d.owner || ""}
                  right={(d.measurement?.outcome ?? "in progress").toUpperCase()} rightColor={OUTCOME_COLOR[d.measurement?.outcome ?? ""] ?? "#f59e0b"} />
              ))
            )}
          </RSection>
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 16 }}>Internal assumptions, rates and leak-by-leak detail are not shown in this view.</div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
            {card("Plan Profit", money(h.planProfit))}
            {h.actualProfit != null && card("Actual Profit", money(h.actualProfit), h.actualProfit >= h.planProfit ? "#4ade80" : "#f87171")}
            {h.correctedProfit != null && card("Corrected Profit", money(h.correctedProfit), "#4ade80")}
            {h.profitGap != null && card("Profit Gap", signedMoney(h.profitGap), h.profitGap >= 0 ? "#4ade80" : "#f87171")}
            {h.biggestLeakLabel && card("Biggest Leak", `${h.biggestLeakLabel} ${signedMoney(h.biggestLeakImpact ?? 0)}`, "#f87171")}
          </div>

          {report.variance && report.variance.ranked.length > 0 && (
            <RSection title="Where the funnel leaked">
              {report.variance.ranked.map((v) => (
                <RRow key={v.nodeId} left={report.labels[v.nodeId] ?? v.nodeId}
                  mid={`${v.metric}${v.pctOffPlan != null ? " " + signedPct(v.pctOffPlan) : ""}`}
                  right={signedMoney(v.profitImpact)} rightColor={v.leak ? "#f87171" : "#4ade80"} />
              ))}
            </RSection>
          )}

          {report.calibration && report.calibration.proposals.length > 0 && (
            <RSection title="Corrected rates (calibration)">
              {report.calibration.proposals.map((pr, i) => (
                <RRow key={i} left={report.labels[pr.nodeId] ?? pr.nodeId} mid={pr.field}
                  right={`${fmtProp(pr.unit, pr.planValue)} → ${fmtProp(pr.unit, pr.proposedValue)}`} rightColor="#4ade80" />
              ))}
            </RSection>
          )}

          <RSection title={`Decisions (${report.decisions.summary.measured}/${report.decisions.summary.total} measured)`}>
            {report.decisions.items.length === 0 ? (
              <div style={{ color: "var(--dim)", fontSize: 13 }}>No decisions logged.</div>
            ) : (
              report.decisions.items.map((d) => (
                <RRow key={d.id} left={d.move || "(untitled)"} mid={`${d.confidence} conf${d.owner ? " · " + d.owner : ""}`}
                  right={(d.measurement?.outcome ?? "open").toUpperCase()} rightColor={OUTCOME_COLOR[d.measurement?.outcome ?? ""] ?? "#f59e0b"} />
              ))
            )}
          </RSection>
        </>
      )}
    </div>
  );
}

/** Client-safe export: outcomes and decisions only — no node-level rates,
 *  assumptions or leak detail, so it can't be used to reverse-engineer how
 *  the model works. */
export function clientSummaryToHtml(report: FunnelReport): string {
  const h = report.headline;
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
  const kpi = (k: string, v: string, c = "#111827") => `<div class="kpi"><div class="k">${k}</div><div class="v" style="color:${c}">${v}</div></div>`;
  const onTrack = h.profitGap == null ? null : h.profitGap >= 0;
  const statusColor = onTrack == null ? "#6b7280" : onTrack ? "#15803d" : "#b91c1c";
  const statusText = onTrack == null ? "This funnel's plan is set — no results recorded yet."
    : onTrack ? "This funnel is beating plan." : "This funnel is behind plan.";
  const decRows = report.decisions.items.map((d) =>
    `<tr><td>${esc(d.move || "(untitled)")}</td><td class="mid">${esc(d.owner || "")}</td><td class="r" style="color:${OUTCOME_COLOR[d.measurement?.outcome ?? ""] ?? "#C93400"}">${esc((d.measurement?.outcome ?? "in progress").toUpperCase())}</td></tr>`,
  ).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.name)} — Summary</title>
<style>
body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#111827;max-width:720px;margin:32px auto;padding:0 20px}
h1{font-size:24px;margin:0 0 2px} .sub{color:#6b7280;font-size:13px;margin-bottom:20px}
.status{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:10px;margin-bottom:22px;background:${statusColor}18;border:1px solid ${statusColor};color:${statusColor};font-weight:500;font-size:14px}
.kpis{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:26px}
.kpi{border:1px solid #e5e7eb;border-radius:10px;padding:10px 16px;min-width:130px}
.kpi .k{font-size:11px;color:#6b7280} .kpi .v{font-size:20px;font-weight:700}
h2{font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;margin:24px 0 6px}
table{width:100%;border-collapse:collapse} td{padding:7px 0;border-bottom:1px solid #eee;font-size:14px}
td.mid{color:#6b7280;font-size:12px;text-align:center} td.r{text-align:right;font-weight:700}
.note{font-size:11px;color:#9ca3af;margin-top:18px}
@media print{body{margin:0}}
</style></head><body>
<h1>${esc(report.name)}</h1><div class="sub">Generated ${new Date(report.generatedAt).toLocaleString()}</div>
<div class="status">${statusText}</div>
<div class="kpis">
${kpi("Plan Profit", money(h.planProfit))}
${h.actualProfit != null ? kpi("Actual Profit", money(h.actualProfit), h.actualProfit >= h.planProfit ? "#15803d" : "#b91c1c") : ""}
${h.correctedProfit != null ? kpi("Updated Forecast", money(h.correctedProfit), "#15803d") : ""}
</div>
<h2>What's been decided</h2>
${decRows ? `<table>${decRows}</table>` : `<div style="color:#9ca3af;font-size:13px">No decisions logged yet.</div>`}
<div class="note">Internal assumptions, rates and leak-by-leak detail are not included in this summary.</div>
</body></html>`;
}

export function reportToHtml(report: FunnelReport): string {
  const h = report.headline;
  const fmtProp = (unit: CalibProposal["unit"], v: number) => (unit === "minor" ? money(v) : unit === "rate" ? `${(v * 100).toFixed(1)}%` : num(v));
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
  const row = (l: string, m: string, r: string, c: string) =>
    `<tr><td>${esc(l)}</td><td class="mid">${esc(m)}</td><td class="r" style="color:${c}">${esc(r)}</td></tr>`;
  const leakRows = report.variance
    ? report.variance.ranked.map((v) => row(report.labels[v.nodeId] ?? v.nodeId, `${v.metric}${v.pctOffPlan != null ? " " + signedPct(v.pctOffPlan) : ""}`, signedMoney(v.profitImpact), v.leak ? "#b91c1c" : "#15803d")).join("")
    : "";
  const calibRows = report.calibration
    ? report.calibration.proposals.map((pr) => row(report.labels[pr.nodeId] ?? pr.nodeId, pr.field, `${fmtProp(pr.unit, pr.planValue)} → ${fmtProp(pr.unit, pr.proposedValue)}`, "#15803d")).join("")
    : "";
  const decRows = report.decisions.items.map((d) =>
    row(d.move || "(untitled)", `${d.confidence} conf${d.owner ? " · " + d.owner : ""}`, (d.measurement?.outcome ?? "open").toUpperCase(), "#334155")).join("");
  const kpi = (k: string, v: string, c = "#111827") => `<div class="kpi"><div class="k">${k}</div><div class="v" style="color:${c}">${v}</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.name)} — Report</title>
<style>
body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#111827;max-width:820px;margin:32px auto;padding:0 20px}
h1{font-size:24px;margin:0 0 2px} .sub{color:#6b7280;font-size:13px;margin-bottom:20px}
.kpis{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:26px}
.kpi{border:1px solid #e5e7eb;border-radius:10px;padding:10px 16px;min-width:120px}
.kpi .k{font-size:11px;color:#6b7280} .kpi .v{font-size:20px;font-weight:700}
h2{font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;margin:24px 0 6px}
table{width:100%;border-collapse:collapse} td{padding:7px 0;border-bottom:1px solid #eee;font-size:14px}
td.mid{color:#6b7280;font-size:12px;text-align:center} td.r{text-align:right;font-weight:700}
@media print{body{margin:0}}
</style></head><body>
<h1>${esc(report.name)}</h1><div class="sub">Generated ${new Date(report.generatedAt).toLocaleString()}</div>
<div class="kpis">
${kpi("Plan Profit", money(h.planProfit))}
${h.actualProfit != null ? kpi("Actual Profit", money(h.actualProfit), h.actualProfit >= h.planProfit ? "#15803d" : "#b91c1c") : ""}
${h.correctedProfit != null ? kpi("Corrected Profit", money(h.correctedProfit), "#15803d") : ""}
${h.profitGap != null ? kpi("Profit Gap", signedMoney(h.profitGap), h.profitGap >= 0 ? "#15803d" : "#b91c1c") : ""}
${h.biggestLeakLabel ? kpi("Biggest Leak", `${esc(h.biggestLeakLabel)} ${signedMoney(h.biggestLeakImpact ?? 0)}`, "#b91c1c") : ""}
</div>
${leakRows ? `<h2>Where the funnel leaked</h2><table>${leakRows}</table>` : ""}
${calibRows ? `<h2>Corrected rates (calibration)</h2><table>${calibRows}</table>` : ""}
<h2>Decisions (${report.decisions.summary.measured}/${report.decisions.summary.total} measured)</h2>
${decRows ? `<table>${decRows}</table>` : `<div style="color:#9ca3af;font-size:13px">No decisions logged.</div>`}
</body></html>`;
}
