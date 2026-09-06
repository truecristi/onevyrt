"use client";
/**
 * The React-Flow canvas layer for the funnel studio: the block card (GBNode),
 * its page-preview Mockup, annotations (sticky notes / text), the curvy edge,
 * and the node/edge type registries + initial seed graph. Extracted from
 * funnel-studio.tsx so the 4k-line StudioInner isn't also carrying the canvas
 * rendering. inspectorBridge is the singleton StudioInner wires its
 * open-tab/checklist/audit callbacks into, shared by importing this one object.
 */
import { memo } from "react";
import {
  Handle, Position, NodeToolbar, BaseEdge, getBezierPath, useReactFlow,
  type Node, type Edge, type NodeProps, type NodeTypes, type EdgeProps, type EdgeTypes,
} from "@xyflow/react";
import { defaultData, type RFNodeData } from "../../lib/funnel-map";
import { ACCENT, KIND_COLOR, KIND_ICON, money, num, signedMoney } from "../../lib/studio-ui";
import { type NodeVariance } from "@onevyrt/engine";
import { brandOf } from "./blocks-catalog";
import { type Mode, type InspTab } from "../../lib/studio/types";
import { GOLDEN_PORTRAIT } from "../../lib/design/golden";
import { type AnnotationData } from "../../lib/studio/funnel-doc";

const CARD_RATIO = GOLDEN_PORTRAIT;   // PORTRAIT: taller than wide (w/h) — the golden ratio 1/φ (was 92/150 ≈ 0.613)
export const MIN_W = 64, MAX_W = 260;
export const cardH = (w: number) => Math.round(w / CARD_RATIO);

const H_YES = "#22c55e";
const H_NO = "#f43f5e";
const H_NEXT = "#3b82f6";
// Solid, high-contrast dots. Flow reads left->right and top->bottom, so every
// block accepts from the LEFT and TOP, and emits from the RIGHT and BOTTOM.
const handleDot = (c: string) => ({
  width: 6, height: 6, background: "var(--surface)", border: `1.5px solid ${c}`,
  boxShadow: "none", borderRadius: 999, opacity: 0.55,
});
const nodeUi = (d: Record<string, unknown>): Record<string, unknown> | null => (d.ui && typeof d.ui === "object" ? d.ui as Record<string, unknown> : null);
const GROUP_HUES = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#dc2626"];
const groupColor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GROUP_HUES[h % GROUP_HUES.length];
};
export const signedPct = (p: number) => (p >= 0 ? "+" : "") + (p * 100).toFixed(0) + "%";

const CARD_BRANDS: { label: string; bg: string; fg: string }[] = [
  { label: "VISA", bg: "#1a1f71", fg: "#ffffff" },
  { label: "MC", bg: "#eb001b", fg: "#ffffff" },
  { label: "AMEX", bg: "#006fcf", fg: "#ffffff" },
];

/** A small, honest impression of the page this block represents. Not a preview of
 *  the real page \u2014 it is a type cue, so a glance at the canvas reads as a funnel
 *  rather than a flowchart. */
function Mockup({ d, cardW }: { d: RFNodeData; cardW: number }) {
  // Everything below is expressed relative to a 132px reference card, then scaled
  // by the actual width, so the preview is proportional at any block size.
  const k = Math.max(0.7, Math.min(1.8, cardW / 132));
  const px = (n: number) => Math.round(n * k);
  const label = (d.label ?? "").toLowerCase();
  const isAd = d.kind === "traffic";
  const isCheckout = d.kind === "offer" || /checkout|order|cart|payment/.test(label);
  const isVideo = /video|vsl|webinar|youtube|watch/.test(label);
  const bar = (w: string, h = px(3), c = "var(--chip)") => (
    <span style={{ display: "block", width: w, height: h, borderRadius: 3, background: c }} />
  );
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 5, overflow: "hidden", marginBottom: 7, background: "var(--surface2)" }}>
      {/* browser chrome */}
      <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 5px", borderBottom: "1px solid var(--border)", background: "var(--chip)" }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: "#FF5F57" }} />
        <span style={{ width: 5, height: 5, borderRadius: 999, background: "#FEBC2E" }} />
        <span style={{ width: 5, height: 5, borderRadius: 999, background: "#28C840" }} />
      </div>
      <div style={{ padding: `${px(4)}px ${px(4)}px ${px(5)}px`, display: "flex", flexDirection: "column", gap: px(3) }}>
        {isAd ? (
          <>
            <div style={{ height: px(16), borderRadius: 3, background: "var(--chip)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: px(9), color: "var(--dim)" }}>{"▣"}</span>
            </div>
            {bar("90%")}
            {bar("55%")}
            <span style={{ height: 7, width: "38%", borderRadius: 2, background: ACCENT, marginTop: 1 }} />
          </>
        ) : isVideo ? (
          <>
            <div style={{ height: px(18), borderRadius: 3, background: "var(--chip)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ width: 0, height: 0, borderLeft: "7px solid var(--dim)", borderTop: "4.5px solid transparent", borderBottom: "4.5px solid transparent", marginLeft: 2 }} />
            </div>
            {bar("70%")}
          </>
        ) : isCheckout ? (
          <>
            {bar("55%", px(5))}
            <div style={{ display: "flex", gap: 3 }}>
              {bar("100%", 8, "var(--chip)")}
            </div>
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {CARD_BRANDS.map((c) => (
                <span key={c.label} style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: c.fg, background: c.bg, borderRadius: 2, padding: "2px 3px", lineHeight: 1 }}>{c.label}</span>
              ))}
              <span style={{ marginLeft: "auto", height: 8, width: "34%", borderRadius: 2, background: ACCENT }} />
            </div>
          </>
        ) : (
          <>
            {bar("62%", px(5))}
            {bar("100%")}
            {bar("84%")}
            <span style={{ height: 8, width: "42%", borderRadius: 2, background: ACCENT, marginTop: 1 }} />
          </>
        )}
      </div>
    </div>
  );
}

// GBNode is rendered by React Flow via nodeTypes, which only ever passes it
// NodeProps — there's no channel to hand it StudioInner's setInspTab/
// setChecklistOpen as ordinary props. StudioInner keeps this singleton's
// callbacks in sync via a useEffect; harmless because the app only ever
// mounts one canvas at a time.
export const inspectorBridge: { openTab?: (t: InspTab) => void; openChecklist?: () => void; auditPage?: (nodeId: string) => void } = {};

function GBNode(props: NodeProps) {
  const d = props.data as RFNodeData & { _mode?: Mode; _v?: NodeVariance; _in?: number; _hasActual?: boolean; _showNote?: boolean; _riskSeverity?: "low" | "medium" | "high" };
  const color = KIND_COLOR[d.kind] ?? "#64748b";
  const metric =
    d.kind === "traffic" ? `${d.visitors ?? 0} @ ${money(d.costPerVisitor ?? 0)}`
    : d.kind === "step" ? `${Math.round((d.passRate ?? 0) * 100)}% pass`
    : d.kind === "offer" ? `${Math.round((d.conversionRate ?? 0) * 100)}% @ ${money(d.price ?? 0)}`
    : `${Math.round((d.yesRate ?? 0) * 100)}% yes`;
  const detail =
    d.kind === "traffic" ? `Spend ${money((d.visitors ?? 0) * (d.costPerVisitor ?? 0))}`
    : d.kind === "step" ? `${Math.round((1 - (d.passRate ?? 0)) * 100)}% drop off`
    : d.kind === "offer" ? `AOV ${money(d.price ?? 0)}`
    : null;
  const v = d._mode === "variance" ? d._v : undefined;
  const vColor = v ? (v.leak ? "#f87171" : "#4ade80") : "#000";
  const inflow = typeof d._in === "number" ? d._in : null;
  const cardW = typeof d.w === "number" && d.w >= MIN_W && d.w <= MAX_W ? d.w : 132;
  const brand = brandOf(d.label ?? "", d.kind, d.brand);
  const sc = cardW / 182;
  const fs = (base: number) => Math.max(7, Math.round(base * sc));
  const tier: "badge" | "icon" | "compact" | "full" = cardW < 70 ? "badge" : cardW < 84 ? "icon" : cardW < 100 ? "compact" : "full";
  const small = tier === "badge" || tier === "icon";
  const iconPx = tier === "badge" ? Math.round(cardW * 0.52) : tier === "icon" ? Math.round(cardW * 0.30) : 18;
  // Only nodes that render the page-preview Mockup need the tall portrait
  // frame; everything else hugs its own content instead of leaving dead
  // space at the bottom of the card.
  const showsMockup = tier === "full" && (d.kind === "step" || d.kind === "offer" || d.kind === "traffic");
  const auditScoreRaw = (d.ui as Record<string, unknown> | undefined)?.auditScore;
  const auditScore = typeof auditScoreRaw === "number" && Number.isFinite(auditScoreRaw) ? Math.round(auditScoreRaw) : null;
  const auditTone = auditScore == null ? "" : auditScore >= 75 ? "var(--good-border)" : auditScore >= 50 ? "var(--warn-text)" : "var(--bad-text)";
  const auditBg = auditScore == null ? "" : auditScore >= 75 ? "var(--good-bg)" : auditScore >= 50 ? "var(--warn-bg)" : "var(--bad-bg)";
  const rf = useReactFlow();
  const onGrip = (e: { clientX: number; stopPropagation: () => void; preventDefault: () => void }) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX, startW = cardW;
    const zoom = rf.getViewport().zoom || 1;
    const move = (ev: MouseEvent) => {
      const w = Math.round(Math.max(MIN_W, Math.min(MAX_W, startW + (ev.clientX - startX) / zoom)));
      rf.setNodes((ns: Node[]) => ns.map((n) => (n.id === props.id ? { ...n, data: { ...(n.data as RFNodeData), w } } : n)));
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    document.body.style.userSelect = "none";
  };
  return (
    <>
    <NodeToolbar isVisible={props.selected} position={Position.Top} offset={8}
      style={{ display: "flex", gap: 3, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 3, boxShadow: "0 2px 8px rgba(15,23,42,.15)" }}>
      {/* Each button opens a DISTINCT inspector tab, and the labels match the
          inspector's own tab names (Basics / Numbers / Advanced) so users can
          map them — previously "Style" and "Notes" both opened Advanced and the
          Numbers tab was unreachable from the card. */}
      <button className="nodrag" onClick={() => inspectorBridge.openTab?.("basics")} title="Basics"
        style={{ background: "transparent", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}>✎ Basics</button>
      <button className="nodrag" onClick={() => inspectorBridge.openTab?.("numbers")} title="Numbers"
        style={{ background: "transparent", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}>📊 Numbers</button>
      <button className="nodrag" onClick={() => inspectorBridge.openTab?.("advanced")} title="Advanced (style, notes)"
        style={{ background: "transparent", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}>⚙ Advanced</button>
      <button className="nodrag" onClick={() => inspectorBridge.openChecklist?.()} title="Checklist"
        style={{ background: "transparent", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}>✓ Checklist</button>
      {(d.kind === "step" || d.kind === "offer" || d.kind === "traffic") && (
        <button className="nodrag" onClick={() => inspectorBridge.auditPage?.(props.id)} title="Audit this page against Ryan Deiss landing-page principles (your AI)"
          style={{ background: "transparent", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}>🔍 Audit</button>
      )}
    </NodeToolbar>
    <div style={{ background: "var(--surface)", border: `1px solid ${v ? vColor : props.selected ? "var(--good-border)" : "var(--border3)"}`, borderRadius: 13, width: cardW, position: "relative", color: "var(--text)", display: small ? "flex" : undefined, flexDirection: small ? "column" : undefined, alignItems: small ? "center" : undefined, justifyContent: small ? "center" : undefined, boxShadow: props.selected ? "0 0 0 3px var(--accent-soft), 0 4px 14px rgba(0,0,0,.14)" : "0 1px 3px rgba(0,0,0,.08)" }}>
      {/* Content clips to the rounded corners in its own layer, so the connection
          handles below (siblings, not children of this layer) never get cut off. */}
      <div style={{ borderRadius: 13, overflow: "hidden" }}>
      <div style={{ padding: small ? (tier === "badge" ? "3px" : "4px 3px") : "4px 6px 3px", borderBottom: small ? "none" : "1px solid var(--border)", background: small ? undefined : "var(--surface2)", width: small ? "100%" : undefined }}>
        <div style={{ display: "flex", flexDirection: small ? "column" : "row", alignItems: "center", justifyContent: small ? "center" : "flex-start", gap: small ? 6 : 7 }}>
          <span title={brand ? brand.name : undefined} style={{ width: iconPx, height: iconPx, borderRadius: Math.max(4, Math.round(iconPx * 0.26)), background: brand ? (brand.gradient ?? brand.bg) : `${color}18`, color: brand ? brand.fg : color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(iconPx * (brand && brand.glyph.length > 1 ? 0.42 : 0.56)), fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>
            {brand?.svg ? <svg viewBox="0 0 24 24" width={Math.round(iconPx * 0.58)} height={Math.round(iconPx * 0.58)} fill={brand.fg} aria-hidden="true"><path d={brand.svg} /></svg> : (brand ? brand.glyph : (KIND_ICON[d.kind] ?? "\u25cf"))}
          </span>
          {tier !== "badge" && (
            <div style={{ minWidth: 0, maxWidth: "100%", textAlign: small ? "center" : "left" }}>
              <div style={{ fontWeight: 500, fontSize: tier === "icon" ? Math.max(9, Math.round(cardW * 0.11)) : fs(12), color: "var(--text)", letterSpacing: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tier === "icon" && brand ? brand.name : d.label}</div>
              {tier === "full" && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {d._mode === "actual" && d._hasActual === true && (
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: "var(--good-border)", background: "var(--good-bg)", border: "1px solid var(--good-border)", borderRadius: 3, padding: "1px 3px", lineHeight: 1.3 }}>ACTUAL</span>
                  )}
                  {auditScore != null && (
                    <span title="Last landing-page audit score" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: auditTone, background: auditBg, borderRadius: 3, padding: "1px 4px", lineHeight: 1.3 }}>🔍 {auditScore}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {!small && (
      <div style={{ padding: "4px 6px 5px" }}>
        {showsMockup && <Mockup d={d} cardW={cardW} />}
        <div style={{ fontSize: fs(11), color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.35 }}>{metric}</div>
      {tier === "full" && detail && (
        <div style={{ fontSize: fs(10), color: "var(--dim)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</div>
      )}
      {d.kind === "offer" && d.monthlyPrice ? (
        <div style={{ fontSize: fs(11), color: "#60a5fa", marginTop: 3 }}>{"\u21bb "}{money(d.monthlyPrice)}{"/mo"}</div>
      ) : null}
      </div>
      )}
      {inflow != null && !small && (
        <div style={{ padding: "3px 6px", borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: fs(12), fontWeight: 500, lineHeight: 1.2 }}>{num(inflow)}</span>
            {tier === "full" && <span style={{ fontSize: fs(8), letterSpacing: 0.6, color: "var(--dim)", fontWeight: 500 }}>IN</span>}
          </div>
        </div>
      )}
      {v && !small && (
        <div style={{ padding: "5px 7px", borderTop: `1px solid var(--border)` }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: vColor }}>{signedMoney(v.profitImpact)}</div>
          <div style={{ fontSize: 11, color: vColor }}>
            {v.metric} {v.pctOffPlan != null ? signedPct(v.pctOffPlan) : "—"}{v.leak ? " · leak" : " · gain"}
          </div>
        </div>
      )}
      {d._mode === "variance" && !v && (d.kind === "traffic" || d.kind === "offer") && (
        <div style={{ padding: "0 7px 5px", fontSize: 11, color: "var(--dim)" }}>no actual entered</div>
      )}
      </div>
      <Handle id="in" type="target" position={Position.Left} style={handleDot(H_NEXT)} />
      {d.kind === "split" ? (
        <>
          <Handle id="yes" type="source" position={Position.Right} style={{ ...handleDot(H_YES), top: "38%" }} />
          <Handle id="no" type="source" position={Position.Right} style={{ ...handleDot(H_NO), top: "68%" }} />
        </>
      ) : (
        <>
          <Handle id="out" type="source" position={Position.Right} style={handleDot(d.kind === "offer" ? H_YES : H_NEXT)} />
        </>
      )}
      {props.selected && (
        <div className="nodrag nopan gb-resize" onMouseDown={onGrip} title="Drag to resize (ratio kept)"
          style={{ position: "absolute", right: 1, bottom: 1, width: 9, height: 9, borderRadius: "0 0 7px 0", borderRight: `2px solid ${color}`, borderBottom: `2px solid ${color}`, cursor: "nwse-resize", zIndex: 8, opacity: 0, transition: "opacity .12s" }} />
      )}
      {nodeUi(d)?.locked ? <div title="Locked — select with others and Unlock to move it" style={{ position: "absolute", top: 4, left: 4, fontSize: 11, zIndex: 3, lineHeight: 1 }}>🔒</div> : null}
      {nodeUi(d)?.groupId ? <div title={`Group ${String(nodeUi(d)!.groupId)}`} style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: 999, background: groupColor(String(nodeUi(d)!.groupId)), zIndex: 3, boxShadow: "0 0 0 1.5px var(--surface)" }} /> : null}
      {d._showNote && typeof nodeUi(d)?.note === "string" && (nodeUi(d)!.note as string) ? (
        <div title={nodeUi(d)!.note as string} style={{ position: "absolute", top: 4, right: nodeUi(d)?.groupId ? 15 : 4, fontSize: 10, lineHeight: 1, zIndex: 3, opacity: 0.75 }}>📝</div>
      ) : null}
      {d._riskSeverity && (
        <div title={`Risk flag on this block (${d._riskSeverity})`}
          style={{ position: "absolute", bottom: 4, left: 4, width: 8, height: 8, borderRadius: 999, zIndex: 3,
            background: d._riskSeverity === "high" ? "#dc2626" : d._riskSeverity === "medium" ? "#d97706" : "#eab308",
            boxShadow: "0 0 0 1.5px var(--surface)" }} />
      )}
    </div>
    </>
  );
}
// A canvas object that isn't a funnel node — a text label or sticky note.
// Deliberately kept out of RFNodeData/toFunnel entirely (filtered by type
// "annot" at every simulation call site) so it can never reach the engine.
export const STICKY_COLORS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#e9d5ff"];
function AnnotationNode(props: NodeProps) {
  const d = props.data as AnnotationData;
  const rf = useReactFlow();
  const patchText = (text: string) => {
    rf.setNodes((ns: Node[]) => ns.map((n) => (n.id === props.id ? { ...n, data: { ...(n.data as AnnotationData), text } } : n)));
  };
  const cycleColor = () => {
    const i = STICKY_COLORS.indexOf(d.color ?? STICKY_COLORS[0]!);
    const next = STICKY_COLORS[(i + 1) % STICKY_COLORS.length];
    rf.setNodes((ns: Node[]) => ns.map((n) => (n.id === props.id ? { ...n, data: { ...(n.data as AnnotationData), color: next } } : n)));
  };
  if (d.kind === "sticky") {
    return (
      <div style={{ width: 200, minHeight: 120, background: d.color ?? STICKY_COLORS[0], border: `1px solid ${props.selected ? "var(--good-border)" : "rgba(0,0,0,.08)"}`, borderRadius: 8, padding: 10, boxShadow: props.selected ? "0 0 0 3px var(--accent-soft), 0 2px 8px rgba(0,0,0,.18)" : "0 1px 3px rgba(0,0,0,.12)", display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={cycleColor} title="Cycle color" aria-label="Cycle block color" style={{ alignSelf: "flex-end", width: 14, height: 14, borderRadius: 999, border: "1px solid rgba(0,0,0,.2)", background: "transparent", cursor: "pointer", padding: 0 }} />
        <textarea value={d.text ?? ""} onChange={(e) => patchText(e.target.value)} placeholder="Note…"
          style={{ flex: 1, resize: "none", background: "transparent", border: "none", outline: "none", fontSize: 13, lineHeight: 1.4, color: "var(--ds-text-primary)", fontFamily: "inherit" }} />
      </div>
    );
  }
  return (
    <div style={{ minWidth: 60, padding: "2px 4px", border: props.selected ? "1px dashed var(--border-strong)" : "1px dashed transparent", borderRadius: 4 }}>
      <textarea value={d.text ?? ""} onChange={(e) => patchText(e.target.value)} placeholder="Text…" rows={1}
        style={{ width: 220, resize: "both", background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 500, color: "var(--text)", fontFamily: "inherit" }} />
    </div>
  );
}
// Memoized so React Flow only re-renders a node when its own props change —
// panning/zooming or editing one node no longer re-renders every other node's
// body, which is what keeps a large funnel smooth. Safe: memo only skips
// parent-driven re-renders on shallow-equal props; context/hook updates inside
// each node still fire.
export const nodeTypes: NodeTypes = { gb: memo(GBNode), annot: memo(AnnotationNode) };

// A funnel reads better as a curved connector than a right-angled wire —
// same bezier curve React Flow's own "default" edge draws, just wrapped as
// a named type so it's easy to swap the look again later without touching
// every call site.
function CurvyEdge({ id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, style, label, labelStyle, labelBgStyle, labelBgPadding, labelBgBorderRadius }: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.35 });
  return <BaseEdge id={id} path={path} labelX={labelX} labelY={labelY} style={style} label={label} labelStyle={labelStyle}
    labelBgStyle={labelBgStyle} labelBgPadding={labelBgPadding} labelBgBorderRadius={labelBgBorderRadius} />;
}
export const edgeTypes: EdgeTypes = { river: memo(CurvyEdge) };

export const initialNodes: Node[] = [
  { id: "traffic", type: "gb", position: { x: 40, y: 140 }, data: defaultData("traffic", "Facebook Ads") },
  { id: "landing", type: "gb", position: { x: 300, y: 140 }, data: defaultData("step", "Landing Page") },
  { id: "sale", type: "gb", position: { x: 560, y: 140 }, data: defaultData("offer", "Core Offer") },
];
export const initialEdges: Edge[] = [
  { id: "e-traffic-landing", source: "traffic", target: "landing" },
  { id: "e-landing-sale", source: "landing", target: "sale" },
];
