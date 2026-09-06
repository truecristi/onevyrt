"use client";

import { formatMoney, summarizeRiskRegister, type RiskReport, type RiskRegisterEntry } from "@onevyrt/engine";
import { ACCENT, barGhost } from "../../lib/studio-ui";
import { GlassDrawer } from "./GlassDrawer";

export function RiskPanel({
  risk, riskRegister, funnelCurrency, addRiskEntry, removeRiskEntry, cycleRiskStatus, onClose,
}: {
  risk: RiskReport | null;
  riskRegister: RiskRegisterEntry[];
  funnelCurrency: string;
  addRiskEntry: (label: string, description: string, severity: RiskRegisterEntry["severity"], linkedNodeId?: string) => void;
  removeRiskEntry: (id: string) => void;
  cycleRiskStatus: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <GlassDrawer width={420} label="Model risk" onClose={onClose}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>RISK ASSESSMENT</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Model risk</div>
        </div>
        <button onClick={onClose} style={barGhost}>Close</button>
      </div>
      <div style={{ overflowY: "auto", padding: 16 }}>
        {!risk ? (
          <div style={{ fontSize: 13, color: "var(--dim)" }}>Add a traffic source and an offer to assess risk.</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{ width: 66, height: 66, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                background: risk.band === "low" ? "#16a34a22" : risk.band === "moderate" ? "#eab30822" : risk.band === "high" ? "#f9731622" : "#dc262622",
                border: `2px solid ${risk.band === "low" ? "#16a34a" : risk.band === "moderate" ? "#eab308" : risk.band === "high" ? "#f97316" : "#dc2626"}` }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: risk.band === "low" ? "#16a34a" : risk.band === "moderate" ? "#ca8a04" : risk.band === "high" ? "#ea580c" : "#dc2626" }}>{risk.score}</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>{risk.band} risk</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{risk.headline}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
                <div data-term="margin" style={{ fontSize: 11, color: "var(--muted)" }}>Margin</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{Math.round(risk.margin * 100)}%</div>
              </div>
              <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
                <div data-term="breakEvenTraffic" style={{ fontSize: 11, color: "var(--muted)" }}>Break-even traffic</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{risk.breakEven.trafficMultiplier == null ? "—" : Math.round(risk.breakEven.trafficMultiplier * 100) + "%"}</div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div data-term="worstLikelyBest" style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6, letterSpacing: 0.6 }}>
                WORST / LIKELY / BEST CASE <span style={{ fontWeight: 400, color: "var(--dim)" }}>(traffic + rates both {"±"}{Math.round(risk.caseRange.spread * 100)}%)</span>
              </div>
              {(() => {
                const { worst, likely, best } = risk.caseRange;
                const lo = Math.min(worst, 0, likely);
                const hi = Math.max(best, likely, lo + 1);
                const span = hi - lo;
                const pct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));
                return (
                  <div>
                    <div style={{ position: "relative", height: 8, borderRadius: 4, background: "var(--surface2)", marginBottom: 8 }}>
                      <div style={{ position: "absolute", left: `${pct(Math.min(worst, likely))}%`, width: `${Math.abs(pct(best) - pct(worst))}%`, top: 0, bottom: 0, borderRadius: 4, background: best >= 0 && worst >= 0 ? "#16a34a33" : "#dc262633" }} />
                      <div title="Likely (current plan)" style={{ position: "absolute", left: `${pct(likely)}%`, top: -3, bottom: -3, width: 2, background: "var(--text)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: worst >= 0 ? "var(--muted)" : "#dc2626" }}>Worst {formatMoney(worst, funnelCurrency)}</span>
                      <span style={{ fontWeight: 700 }}>Likely {formatMoney(likely, funnelCurrency)}</span>
                      <span style={{ color: "#16a34a" }}>Best {formatMoney(best, funnelCurrency)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            {risk.sensitivities.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6, letterSpacing: 0.6 }}>WHAT MOVES PROFIT MOST</div>
                {risk.sensitivities.slice(0, 5).map((se, i) => {
                  const max = risk.sensitivities[0]!.magnitude || 1;
                  return (
                    <div key={se.nodeId + se.field} style={{ marginBottom: 7 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
                        <span style={{ color: "var(--text)" }}>{se.label} · <span style={{ color: "var(--dim)" }}>{se.field}</span></span>
                        <span style={{ color: "var(--muted)" }}>{formatMoney(se.magnitude, funnelCurrency)}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.round((se.magnitude / max) * 100)}%`, background: i === 0 ? ACCENT : "var(--border-strong)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {risk.assumptions.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6, letterSpacing: 0.6 }}>ASSUMPTIONS TO CHECK</div>
                {risk.assumptions.map((a, i) => {
                  const already = riskRegister.some((r) => r.linkedNodeId === a.nodeId && r.label === a.label && r.status !== "accepted");
                  return (
                    <div key={a.nodeId + a.field + i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: a.severity === "high" ? "#dc2626" : a.severity === "medium" ? "#ea580c" : "#ca8a04", flexShrink: 0 }}>{"⚠"}</span>
                      <span style={{ color: "var(--muted)", flex: 1 }}><b style={{ color: "var(--text)" }}>{a.label}</b> — {a.message}</span>
                      <button disabled={already} onClick={() => addRiskEntry(a.label, a.message, a.severity, a.nodeId)}
                        style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0, opacity: already ? 0.5 : 1 }}>{already ? "Tracked" : "+ Track"}</button>
                    </div>
                  );
                })}
              </div>
            )}
            {riskRegister.length > 0 && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.6 }}>RISK REGISTER</span>
                  <span style={{ fontSize: 11, color: "var(--dim)" }}>
                    {(() => { const s = summarizeRiskRegister(riskRegister); return `${s.open} open · ${s.mitigated} mitigated · ${s.accepted} accepted`; })()}
                  </span>
                </div>
                {riskRegister.map((r) => (
                  <div key={r.id} style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 8, background: "var(--surface2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{r.label}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{r.description}</div>
                      </div>
                      <button onClick={() => removeRiskEntry(r.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
                    </div>
                    <button onClick={() => cycleRiskStatus(r.id)} title="Click to cycle: open → mitigated → accepted"
                      style={{ marginTop: 6, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "none", cursor: "pointer",
                        background: r.status === "open" ? "#dc262622" : r.status === "mitigated" ? "#16a34a22" : "#64748b22",
                        color: r.status === "open" ? "#dc2626" : r.status === "mitigated" ? "#16a34a" : "#64748b" }}>
                      {r.status.toUpperCase()}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </GlassDrawer>
  );
}
