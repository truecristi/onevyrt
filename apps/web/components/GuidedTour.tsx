"use client";

import { useEffect, useState, useCallback } from "react";
import { ACCENT, barGhost, barPrimary } from "../lib/studio-ui";

export interface TourStep {
  /** Matches a `data-tour="<key>"` attribute on the element to spotlight. */
  key: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  { key: "nextmove", title: "1. Follow your next move", body: "This bar always names the single next thing to do and takes you straight there. If you ever feel lost, just follow it — it walks you through the whole loop, one step at a time." },
  { key: "blocks", title: "2. Pick a block", body: "Every funnel starts with traffic. Drag a block from here onto the canvas, or just click one to drop it at the center." },
  { key: "canvas", title: "3. Connect the flow", body: "Drag from the dot on one block's edge to another to connect them. The model recalculates instantly as you build — there's nothing to refresh." },
  { key: "inspector", title: "4. Edit the numbers", body: "Click any block, then set its numbers here — visitors, conversion rate, price. This is what the simulation actually reads. Page blocks also get a 🔍 Audit button to grade your copy with AI." },
  { key: "save", title: "5. Save your work", body: "☁ Save also takes a snapshot in your project's history, so you can always come back to an earlier version. Tip: press ⌘K anytime to jump to any action by name." },
];

/** A spotlight-style walkthrough over the studio's own DOM — no external
 *  library, just getBoundingClientRect on elements tagged data-tour="...".
 *  Recomputes on resize/scroll so the highlight tracks the real layout. */
export function GuidedTour({ onClose }: { onClose: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // stepIdx is always kept in [0, STEPS.length - 1] by the Back/Next handlers below.
  const step = STEPS[stepIdx]!;

  const measure = useCallback(() => {
    const el = document.querySelector(`[data-tour="${step.key}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step.key]);

  useEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    // Layout can shift a frame after the step changes (panels opening/closing).
    const t = setTimeout(measure, 50);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); clearTimeout(t); };
  }, [measure]);

  // Escape ends the tour — keyboard users shouldn't be stuck in it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pad = 6;
  const spot = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;

  // Tooltip position: prefer below the spotlight, flip above if that would
  // run off the bottom of the viewport.
  const tooltipWidth = 320;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200;
  let tooltipTop = spot ? spot.top + spot.height + 12 : viewportH / 2 - 80;
  let placedAbove = false;
  if (spot && tooltipTop + 160 > viewportH) { tooltipTop = Math.max(12, spot.top - 172); placedAbove = true; }
  let tooltipLeft = spot ? Math.min(Math.max(12, spot.left), viewportW - tooltipWidth - 12) : viewportW / 2 - tooltipWidth / 2;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
      {/* Four backdrop rectangles around the spotlight, rather than one big
          overlay with a hole cut in it — simplest way to keep the spotlighted
          element itself fully interactive (not covered by anything) while
          still dimming everything else. */}
      {spot ? (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: Math.max(0, spot.top), background: "rgba(2,6,23,.6)" }} />
          <div style={{ position: "fixed", top: spot.top, left: 0, width: Math.max(0, spot.left), height: spot.height, background: "rgba(2,6,23,.6)" }} />
          <div style={{ position: "fixed", top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height, background: "rgba(2,6,23,.6)" }} />
          <div style={{ position: "fixed", top: spot.top + spot.height, left: 0, right: 0, bottom: 0, background: "rgba(2,6,23,.6)" }} />
          <div style={{ position: "fixed", top: spot.top, left: spot.left, width: spot.width, height: spot.height, border: `2px solid ${ACCENT}`, borderRadius: 8, boxShadow: "0 0 0 4px var(--accent-soft, rgba(8,128,87,0.2))", pointerEvents: "none" }} />
        </>
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,.6)" }} onClick={onClose} />
      )}

      {/* role="dialog" (non-modal — the spotlighted element stays reachable), an
          accessible name from the step, and aria-live so each step change is
          announced to screen-reader users ("2 of 5 — Pick a block"). */}
      <div role="dialog" aria-label={`Guided tour, step ${stepIdx + 1} of ${STEPS.length}: ${step.title}`} aria-live="polite"
        style={{ position: "fixed", top: tooltipTop, left: tooltipLeft, width: tooltipWidth, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, boxShadow: "var(--shadow-panel)", padding: 16, ...(placedAbove ? {} : {}) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700, letterSpacing: 0.6 }}>GUIDED TOUR</span>
          <span style={{ fontSize: 11, color: "var(--dim)" }}>{stepIdx + 1} of {STEPS.length}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 14 }}>{step.body}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onClose} style={{ ...barGhost, fontSize: 12 }}>Skip</button>
          <div style={{ display: "flex", gap: 6 }}>
            {stepIdx > 0 && <button onClick={() => setStepIdx((i) => i - 1)} style={{ ...barGhost, fontSize: 12 }}>Back</button>}
            {stepIdx < STEPS.length - 1 ? (
              <button onClick={() => setStepIdx((i) => i + 1)} style={{ ...barPrimary, fontSize: 12 }}>Next</button>
            ) : (
              <button onClick={onClose} style={{ ...barPrimary, fontSize: 12 }}>Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
