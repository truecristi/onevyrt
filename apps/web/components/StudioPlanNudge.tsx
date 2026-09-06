"use client";
/**
 * Library-screen onboarding nudge. It reflects the ONE guided journey whose
 * single source of truth is /start and the Command Center Home — it does NOT
 * keep a separate step model. So a new user sees the same "what's next" and the
 * same progress everywhere, instead of a library checklist that competed with
 * Your Plan (audit §17 Phase 1: "use /start as the single progress source; merge
 * the library checklist").
 *
 * Purely informational — nothing here gates the product. It loads the journey
 * itself (the same loadJourneyInputs the /start page and Home use), auto-hides
 * once setup is finished, and can be dismissed early.
 */
import { useEffect, useState } from "react";
import { computeJourney, type Journey } from "../lib/studio/journey";
import { loadJourneyInputs } from "../lib/journey-signals";
import { ACCENT, barGhost } from "../lib/studio-ui";

export function StudioPlanNudge({ onDismiss }: { onDismiss: () => void }) {
  const [journey, setJourney] = useState<Journey | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { signals, state } = await loadJourneyInputs();
      if (!alive) return;
      setJourney(computeJourney(signals, state, new Date().toISOString()));
    })();
    return () => { alive = false; };
  }, []);

  // Nothing until the journey is loaded; once every step is done the nudge has
  // served its purpose and removes itself (no dismiss needed).
  if (!journey || journey.finished) return null;
  const next = journey.nextStep;
  const pct = Math.round(journey.progress);

  return (
    <div style={{ border: "1px solid var(--border2)", borderRadius: 14, background: "var(--surface)", padding: "14px 18px", marginBottom: 18, boxShadow: "var(--shadow-soft)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ marginRight: "auto" }}>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>YOUR PLAN</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>One path from your Message to your first booked call</div>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{journey.done}/{journey.total} done</div>
        <button onClick={onDismiss} style={{ ...barGhost, padding: "4px 9px" }} title="Hide this until later" aria-label="Hide the plan nudge">Hide</button>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--surface2)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: ACCENT, transition: "width .3s ease" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {next && (
          <div style={{ marginRight: "auto", minWidth: 200 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.4, color: "var(--dim)", fontWeight: 700 }}>DO THIS NEXT</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 1 }}>{next.title}</div>
          </div>
        )}
        {next && (
          <a href={next.href} className="btn primary sm" style={{ textDecoration: "none" }}>{next.cta} →</a>
        )}
        <a href="/command-center" className="btn ghost sm" style={{ textDecoration: "none" }}>Open your full plan →</a>
      </div>
    </div>
  );
}
