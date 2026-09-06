"use client";
/**
 * "Build a funnel with AI" — the beginner's magic first step. Describe the
 * business in plain words; the connected AI returns a funnel structure that
 * seeds the canvas. Defensive by design: the AI's output is untrusted text, so
 * it's parsed and strictly validated (shape, node kinds, id references,
 * counts) into the app's own model before anything touches the canvas — a
 * malformed response yields a friendly error, never a broken graph. Uses the
 * shared connection: a BYO request goes straight to the provider, and with no
 * personal key it falls back to the included managed AI (via our server).
 */
import { useRef, useState } from "react";
import { callAI, loadConnection } from "../../lib/ai/client";
import { loadGrounding, withGrounding, type Grounding } from "../../lib/ai-grounding";
import { parseFunnel, type BuiltFunnel } from "../../lib/studio/parse-funnel";
import { useDialogA11y } from "../../lib/use-dialog-a11y";
import { MarketingIcon } from "../MarketingIcons";
import { GroundingChips } from "../campaign/GroundingChips";

export type { BuiltFunnel } from "../../lib/studio/parse-funnel";

const SYSTEM =
  'You design marketing funnels. Given a business description, output ONLY a JSON object (no markdown, no prose, no code fences) with EXACTLY this shape: {"name": string, "nodes": [{"id": string, "kind": "traffic"|"step"|"offer", "label": string}], "edges": [["fromId","toId"]]}. Use 4–8 nodes forming a logical path: a traffic source → one or more pages/steps → an offer. "kind" MUST be one of traffic, step, offer. Each node needs a short unique id and a concrete, specific label. "edges" connect node ids in flow order.';

export function AiFunnelBuilder({ onBuild, onClose }: { onBuild: (f: BuiltFunnel) => void; onClose: () => void }) {
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [grounding, setGrounding] = useState<Grounding | null>(null);
  // Was backdrop-click-only: add the focus trap + Escape-to-close + focus return.
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, onClose);

  const run = async () => {
    if (busy || !desc.trim()) return;
    setErr("");
    const conn = loadConnection();
    if (!conn || conn.provider === "manual") {
      setErr("Connect an AI provider in Campaign Studio first — then this works too.");
      return;
    }
    setBusy(true);
    try {
      const g = await loadGrounding();
      setGrounding(g);
      const text = await callAI(conn, SYSTEM, withGrounding(g, `Business: ${desc.trim()}`), 700);
      const funnel = parseFunnel(text);
      if (!funnel) { setErr("The AI didn't return a usable funnel — try rephrasing your description."); return; }
      onBuild(funnel);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't build the funnel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div ref={panelRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Build a funnel with AI"
        style={{ width: 440, maxWidth: "100%", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 18, padding: 22, boxShadow: "var(--shadow-panel)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}><MarketingIcon name="spark" size={16} /> Build a funnel with AI</div>
        <div style={{ fontSize: 12.5, color: "var(--dim)", marginBottom: 14 }}>Describe your business in a sentence or two — the AI will map a starter funnel onto the canvas for you to edit.</div>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus rows={3}
          placeholder="e.g. An online course teaching freelance designers how to land higher-paying clients."
          style={{ width: "100%", boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit" }} />
        {err && <div style={{ fontSize: 12, color: "var(--bad-border)", marginTop: 8 }}>{err}</div>}
        {grounding && <div style={{ marginTop: 8 }}><GroundingChips brand={grounding.brand} strategy={grounding.strategy} /></div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid var(--border3)", borderRadius: 10, color: "var(--muted)", cursor: "pointer", padding: "8px 14px", fontSize: 13, fontWeight: 500 }}>Cancel</button>
          <button onClick={run} disabled={busy || !desc.trim()}
            style={{ background: "var(--good-border)", border: "none", borderRadius: 10, color: "#fff", cursor: busy || !desc.trim() ? "default" : "pointer", padding: "8px 16px", fontSize: 13, fontWeight: 500, opacity: busy || !desc.trim() ? 0.6 : 1 }}>
            {busy ? "Building…" : "Build funnel"}
          </button>
        </div>
      </div>
    </div>
  );
}
