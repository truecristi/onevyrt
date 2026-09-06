"use client";
/**
 * Three read-only "floating glass panel" insight viewers lifted out of
 * funnel-studio.tsx — People Journeys, Recurring revenue (MRR/ARR/LTV/CAC),
 * and Time-to-conversion. Each renders a computed summary the component passes
 * in and owns no state beyond what it's given, so they're pure moves matching
 * the existing ConstraintsPanel pattern.
 */
import type { Node } from "@xyflow/react";
import { formatMoney, type TimelineReport, type RetargetingLoop, type RetargetingResult } from "@onevyrt/engine";
import type { RFNodeData } from "../../lib/funnel-map";
import { ACCENT, barGhost, barPrimary, glassPanel, GLASS_PANEL_CLASS, money, num } from "../../lib/studio-ui";
import type { RecurringSummary } from "./studio-internal";

export interface LoopDraft { fromNodeId: string; fromPort: RetargetingLoop["fromPort"]; toNodeId: string; decayPct: string }

export interface JourneyEventRow { id: string; timestamp: number; type: string; url?: string; sourceLabel?: string; nodeId?: string; label?: string }
export interface JourneySessionRow { id: string; personId?: string; deviceType?: string; country?: string; events: JourneyEventRow[] }

export function JourneyPanel({
  sessions, idx, setIdx, nodes, onClose,
}: {
  sessions: JourneySessionRow[]; idx: number; setIdx: (fn: (i: number) => number) => void;
  nodes: Node[]; onClose: () => void;
}) {
  const real = sessions[idx] ?? null;
  const nodeLabel = (nid?: string) => (nid ? (nodes.find((n) => n.id === nid)?.data as RFNodeData | undefined)?.label ?? nid : undefined);
  return (
    <div className={GLASS_PANEL_CLASS} style={glassPanel(400)}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>PEOPLE JOURNEYS</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{real ? `Session ${idx + 1} of ${sessions.length}` : "Preview"}</div>
        </div>
        <button onClick={onClose} style={barGhost}>Close</button>
      </div>
      <div style={{ padding: 16 }}>
        {!real ? (
          <>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
              No real visitor sessions recorded yet — this is sample data showing the shape a real journey takes once the tracking snippet ({"📡 Live"}) is live on your pages.
            </div>
            <div style={{ opacity: 0.6, pointerEvents: "none" }}>
              <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 4 }}>PERSON ID</div>
              <div style={{ fontSize: 13, marginBottom: 10, fontFamily: "ui-monospace, monospace" }}>82446177</div>
              <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                <div><div style={{ fontSize: 11, color: "var(--dim)" }}>COUNTRY</div><div style={{ fontSize: 13 }}>United States</div></div>
                <div><div style={{ fontSize: 11, color: "var(--dim)" }}>DEVICE</div><div style={{ fontSize: 13 }}>Desktop</div></div>
                <div><div style={{ fontSize: 11, color: "var(--dim)" }}>FIRST TOUCH</div><div style={{ fontSize: 13 }}>Aug 31, 2026</div></div>
              </div>
              <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 6 }}>JOURNEY</div>
              {["Facebook Ads → Landing Page", "Landing Page (visit)", "Video View", "CTA Click", "Core Offer (visit)"].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", marginBottom: 4, borderRadius: 6, background: "var(--surface2)", fontSize: 12 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, flexShrink: 0 }}>{i + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 4 }}>SESSION ID</div>
            <div style={{ fontSize: 13, marginBottom: 10, fontFamily: "ui-monospace, monospace" }}>{real.id}</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
              <div><div style={{ fontSize: 11, color: "var(--dim)" }}>COUNTRY</div><div style={{ fontSize: 13 }}>{real.country ?? "Unknown"}</div></div>
              <div><div style={{ fontSize: 11, color: "var(--dim)" }}>DEVICE</div><div style={{ fontSize: 13 }}>{real.deviceType ?? "Unknown"}</div></div>
              <div><div style={{ fontSize: 11, color: "var(--dim)" }}>FIRST TOUCH</div><div style={{ fontSize: 13 }}>{real.events[0] ? new Date(real.events[0].timestamp).toLocaleDateString() : "—"}</div></div>
            </div>
            <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 6 }}>JOURNEY ({real.events.length} events)</div>
            {real.events.map((ev, i) => (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", marginBottom: 4, borderRadius: 6, background: "var(--surface2)", fontSize: 12 }}>
                <span style={{ width: 16, height: 16, borderRadius: 999, background: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1 }}>{nodeLabel(ev.nodeId) ?? ev.url ?? ev.label ?? ev.type}{ev.type === "conversion" ? " (convert)" : ""}</span>
                {ev.sourceLabel && i === 0 && <span style={{ fontSize: 10, color: "var(--dim)" }}>via {ev.sourceLabel}</span>}
              </div>
            ))}
            {sessions.length > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} style={{ ...barGhost, opacity: idx === 0 ? 0.4 : 1 }}>{"← Newer"}</button>
                <button onClick={() => setIdx((i) => Math.min(sessions.length - 1, i + 1))} disabled={idx === sessions.length - 1} style={{ ...barGhost, opacity: idx === sessions.length - 1 ? 0.4 : 1 }}>{"Older →"}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function RecurringPanel({ recurring, onClose }: { recurring: RecurringSummary; onClose: () => void }) {
  return (
    <div className={GLASS_PANEL_CLASS} style={glassPanel(420)}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>RECURRING REVENUE</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>MRR, ARR, LTV &amp; CAC</div>
        </div>
        <button onClick={onClose} style={barGhost}>Close</button>
      </div>
      <div style={{ overflowY: "auto", padding: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ flex: "1 1 45%", background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>MRR</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{money(recurring.mrr)}</div>
          </div>
          <div style={{ flex: "1 1 45%", background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>ARR</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{money(recurring.arr)}</div>
          </div>
          <div style={{ flex: "1 1 45%", background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Total LTV</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{money(recurring.ltv)}</div>
          </div>
          <div style={{ flex: "1 1 45%", background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Subscribers</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{num(recurring.subscribers)}</div>
          </div>
          <div style={{ flex: "1 1 45%", background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>CAC (traffic spend / sub)</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{recurring.cac == null ? "—" : money(recurring.cac)}</div>
          </div>
          <div style={{ flex: "1 1 45%", background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>LTV : CAC</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: recurring.ltvToCac != null && recurring.ltvToCac >= 3 ? "#16a34a" : recurring.ltvToCac != null && recurring.ltvToCac < 1 ? "#dc2626" : "var(--text)" }}>
              {recurring.ltvToCac == null ? "—" : `${recurring.ltvToCac.toFixed(1)}x`}
            </div>
          </div>
          {(() => {
            // Payback: months of subscription revenue to recover CAC.
            const perSub = recurring.subscribers > 0 ? recurring.mrr / recurring.subscribers : 0;
            const payback = recurring.cac != null && perSub > 0 ? recurring.cac / perSub : null;
            return (
              <div style={{ flex: "1 1 45%", background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>CAC payback</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: payback != null && payback <= 12 ? "#16a34a" : payback != null && payback > 24 ? "#dc2626" : "var(--text)" }}>
                  {payback == null ? "—" : `${payback.toFixed(1)} mo`}
                </div>
              </div>
            );
          })()}
        </div>
        {recurring.byNode.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6, letterSpacing: 0.6 }}>BY RECURRING OFFER</div>
            {recurring.byNode.map((r) => (
              <div key={r.nodeId} style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 8, background: "var(--surface2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                  <span>{r.label}</span>
                  <span>{money(r.mrr)}/mo</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                  {num(r.subscribers)} subscribers · {money(r.ltv)} lifetime value
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TimelinePanel({ timeline, labelOf, onClose }: { timeline: TimelineReport; labelOf: Record<string, string>; onClose: () => void }) {
  return (
    <div className={GLASS_PANEL_CLASS} style={glassPanel(420)}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>TIMELINE</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Time to conversion</div>
        </div>
        <button onClick={onClose} style={barGhost}>Close</button>
      </div>
      <div style={{ overflowY: "auto", padding: 16 }}>
        <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>OVERALL (BUYER-WEIGHTED)</div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            {timeline.overallDaysToConvert == null ? "—" : `${timeline.overallDaysToConvert.toFixed(1)} days`}
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6, letterSpacing: 0.6 }}>BY OFFER</div>
        {timeline.offers.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--dim)" }}>No offer nodes on the canvas yet.</div>
        ) : (
          timeline.offers.map((o) => (
            <div key={o.nodeId} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, padding: "8px 10px", borderRadius: 8, background: "var(--surface2)" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{labelOf[o.nodeId] ?? o.nodeId}</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{o.daysToConvert.toFixed(1)} days</span>
            </div>
          ))
        )}
        <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 10 }}>Set &quot;Delay (days)&quot; on any block&apos;s Settings tab to model wait steps, replay windows, or follow-up sequences.</div>
      </div>
    </div>
  );
}

export function RetargetingPanel({
  nodes, loopDraft, setLoopDraft, addRetargetingLoop, retargetingLoops, removeRetargetingLoop,
  retargetingResult, labelOf, funnelCurrency, onClose,
}: {
  nodes: Node[];
  loopDraft: LoopDraft; setLoopDraft: (fn: (d: LoopDraft) => LoopDraft) => void;
  addRetargetingLoop: (fromNodeId: string, fromPort: RetargetingLoop["fromPort"], toNodeId: string, decayRate: number) => void;
  retargetingLoops: RetargetingLoop[]; removeRetargetingLoop: (id: string) => void;
  retargetingResult: RetargetingResult | null;
  labelOf: Record<string, string>; funnelCurrency: string; onClose: () => void;
}) {
  return (
    <div className={GLASS_PANEL_CLASS} style={glassPanel(420)}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>CONTROLLED LOOPS</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Retargeting</div>
        </div>
        <button onClick={onClose} style={barGhost}>Close</button>
      </div>
      <div style={{ overflowY: "auto", padding: 16 }}>
        <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 14 }}>Model a decayed portion of a node&apos;s drop-offs re-entering the funnel — an ad retargeting a bounced visitor, a &quot;didn&apos;t buy&quot; split re-emailed back to the offer. Solved exactly via the model&apos;s own math, not a rough guess.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, background: "var(--surface2)", padding: 10, borderRadius: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <select value={loopDraft.fromNodeId} onChange={(e) => setLoopDraft((d) => ({ ...d, fromNodeId: e.target.value }))}
              style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }}>
              <option value="">From block…</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{(n.data as RFNodeData).label}</option>)}
            </select>
            <select value={loopDraft.fromPort} onChange={(e) => setLoopDraft((d) => ({ ...d, fromPort: e.target.value as RetargetingLoop["fromPort"] }))}
              style={{ background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }}>
              <option value="no">the &quot;no&quot; branch</option>
              <option value="out">everyone who continues (its only output)</option>
              <option value="yes">the &quot;yes&quot; branch</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--dim)" }}>re-enters at</span>
            <select value={loopDraft.toNodeId} onChange={(e) => setLoopDraft((d) => ({ ...d, toNodeId: e.target.value }))}
              style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }}>
              <option value="">To block…</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{(n.data as RFNodeData).label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--dim)" }}>decay</span>
            <input type="range" min={0} max={90} value={loopDraft.decayPct} onChange={(e) => setLoopDraft((d) => ({ ...d, decayPct: e.target.value }))} style={{ flex: 1 }} />
            <span style={{ fontSize: 12, fontWeight: 700, width: 34 }}>{loopDraft.decayPct}%</span>
            <button onClick={() => { addRetargetingLoop(loopDraft.fromNodeId, loopDraft.fromPort, loopDraft.toNodeId, Number(loopDraft.decayPct) / 100); setLoopDraft((d) => ({ ...d, fromNodeId: "", toNodeId: "" })); }}
              style={barPrimary}>Add</button>
          </div>
        </div>
        {retargetingLoops.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--dim)" }}>No loops yet — the plan is a straight line, exactly like before.</div>
        ) : (
          retargetingLoops.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, padding: "6px 8px", borderRadius: 7, background: "var(--surface2)", fontSize: 12 }}>
              <span style={{ flex: 1 }}>{labelOf[l.fromNodeId] ?? l.fromNodeId} ({l.fromPort}) → {labelOf[l.toNodeId] ?? l.toNodeId} · {Math.round(l.decayRate * 100)}%</span>
              <button onClick={() => removeRetargetingLoop(l.id)} style={{ ...barGhost, padding: "2px 7px", fontSize: 11, flexShrink: 0 }}>Remove</button>
            </div>
          ))
        )}
        {retargetingResult && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, letterSpacing: 0.6 }}>WITH RETARGETING vs PLAN</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "var(--muted)" }}>Buyers</span>
              <span>{num(retargetingResult.basePass.totals.buyers)} → <b>{num(retargetingResult.totals.buyers)}</b></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "var(--muted)" }}>Revenue</span>
              <span>{formatMoney(retargetingResult.basePass.totals.revenue, funnelCurrency)} → <b>{formatMoney(retargetingResult.totals.revenue, funnelCurrency)}</b></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ fontWeight: 700 }}>Profit</span>
              <span style={{ fontWeight: 700, color: "#16a34a" }}>{formatMoney(retargetingResult.basePass.totals.grossProfit, funnelCurrency)} → {formatMoney(retargetingResult.totals.grossProfit, funnelCurrency)}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 8 }}>
              Converged after {retargetingResult.iterations} pass{retargetingResult.iterations === 1 ? "" : "es"}{retargetingResult.truncated ? " — still decaying, numbers are a lower bound" : ""}.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
