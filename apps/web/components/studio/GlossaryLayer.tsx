"use client";

import { useEffect, useRef, useState } from "react";
import { GLOSSARY, GLOSSARY_CATEGORY_COLOR, GLOSSARY_CATEGORY_LABEL } from "../../lib/glossary";
import { barGhost } from "../../lib/studio-ui";

/**
 * App-wide "define this term" layer (shift+click any element carrying
 * data-term="key"): one document-level listener, mounted once, rather than
 * an onClick handler at every one of the hundreds of labels that carry a
 * data-term attribute — those elements stay plain spans/divs with no
 * behavior of their own, so tagging a new one is a one-line addition, not
 * a new component instance.
 *
 * Listens in the CAPTURE phase and stops propagation on a match, so
 * shift+clicking a label inside an otherwise-clickable element (e.g. a
 * Tools Hub tile) shows the definition instead of also triggering that
 * element's own click handler.
 */
export function GlossaryLayer({ onAskCopilot }: { onAskCopilot?: (termLabel: string) => void }) {
  const [open, setOpen] = useState<{ key: string; x: number; y: number } | null>(null);
  // One-time discoverability hint — the whole feature was invisible before, so
  // nobody knew a definition was a shift-click away. Shown once per browser.
  const [hint, setHint] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  const dismissHint = () => { setHint(false); try { localStorage.setItem("gb-glossary-hint", "1"); } catch { /* private mode */ } };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!e.shiftKey) return;
      const target = e.target as HTMLElement;
      const hit = target.closest<HTMLElement>("[data-term]");
      const key = hit?.dataset.term;
      if (!key || !GLOSSARY[key]) return;
      e.preventDefault();
      e.stopPropagation();
      const r = hit.getBoundingClientRect();
      setOpen({ key, x: Math.min(r.left, window.innerWidth - 340), y: r.bottom + 8 });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Make definable terms visible on demand: while Shift is held, every element
  // carrying data-term gets a "help" cursor and lights up on hover, so the user
  // can SEE what's definable instead of having to already know. Pure CSS toggled
  // by a class on <html>; costs nothing when Shift isn't down.
  useEffect(() => {
    const root = document.documentElement;
    const down = (e: KeyboardEvent) => { if (e.key === "Shift") root.classList.add("gb-defining"); };
    const clear = () => root.classList.remove("gb-defining");
    const up = (e: KeyboardEvent) => { if (e.key === "Shift") clear(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); clear(); };
  }, []);

  // Surface the hint once, and never again after the user has opened a definition.
  useEffect(() => { try { if (!localStorage.getItem("gb-glossary-hint")) setHint(true); } catch { /* private mode */ } }, []);
  useEffect(() => { if (open && hint) dismissHint(); }, [open, hint]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("click", onOutside);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onOutside); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const entry = open ? GLOSSARY[open.key] : null;
  const color = entry ? GLOSSARY_CATEGORY_COLOR[entry.category] : "#888";

  return (
    <>
      <style>{`
        html.gb-defining [data-term]{ cursor: help; }
        html.gb-defining [data-term]:hover{ text-decoration: underline dotted currentColor; text-underline-offset: 3px; }
        @keyframes gbGlossHint{ from{ opacity: 0; transform: translate(-50%, 8px); } to{ opacity: 1; transform: translate(-50%, 0); } }
      `}</style>

      {hint && !open && (
        <div role="status" style={{
          position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", zIndex: 88,
          display: "flex", alignItems: "center", gap: 10, maxWidth: "92vw",
          background: "var(--glass-bg)", border: "1px solid var(--border)", borderRadius: 999,
          boxShadow: "var(--shadow-panel)", padding: "8px 10px 8px 16px", backdropFilter: "blur(20px) saturate(1.4)",
          fontSize: 12.5, color: "var(--text)", animation: "gbGlossHint .2s ease both",
        }}>
          <span>Tip: hold <kbd style={{ fontFamily: "inherit", fontWeight: 700, border: "1px solid var(--border3)", borderRadius: 5, padding: "1px 6px", fontSize: 11 }}>Shift</kbd> and click any metric to see what it means.</span>
          <button onClick={dismissHint} style={{ ...barGhost, fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>Got it</button>
        </div>
      )}

      {open && entry && (
        <div ref={popRef} style={{
          position: "fixed", left: open.x, top: open.y, width: 320, maxWidth: "92vw", zIndex: 90,
          background: "var(--glass-bg)", border: `1px solid ${color}55`, borderRadius: 14,
          boxShadow: "var(--shadow-panel)", padding: "14px 16px", backdropFilter: "blur(20px) saturate(1.4)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color, textTransform: "uppercase" }}>{GLOSSARY_CATEGORY_LABEL[entry.category]}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{entry.label}</div>
            </div>
            <button onClick={() => setOpen(null)} title="Close"
              aria-label="Close"
              style={{ width: 24, height: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)", border: "none", borderRadius: 999, color: "var(--muted)", cursor: "pointer", fontSize: 12 }}>✕</button>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>{entry.definition}</div>
          {onAskCopilot && (
            <button onClick={() => { onAskCopilot(entry.label); setOpen(null); }} style={{ ...barGhost, marginTop: 10, width: "100%", fontSize: 12, padding: "6px 10px" }}>
              Ask AI Copilot about this →
            </button>
          )}
        </div>
      )}
    </>
  );
}
