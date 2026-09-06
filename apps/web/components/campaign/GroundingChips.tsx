"use client";
/**
 * Small "what the AI is grounded in" indicator for the Campaign Studio / funnel
 * generators. Makes the otherwise-invisible grounding visible and trustworthy:
 * a green pill for each source that's actually feeding the model (the Brand
 * Brain and/or the Business-OS strategy), and — when a source is missing — a
 * muted pill linking to where the user can fill it in. Purely presentational;
 * the caller passes booleans it already computes for the prompt.
 */

import { CANONICAL_ROUTES } from "../../lib/navigation/canonical-routes";

// Theme-aware brand green (the old literal #0a9e6e was the DARK theme's brand
// value, so the pill sat slightly off-brand in light mode). The alpha edge the
// literal enabled is kept via color-mix, which this codebase already uses.
const GREEN = "var(--ds-brand)";
const DIM = "var(--ds-text-tertiary)"; // theme-aware muted text (was a light-only #586687)

function Pill({ on, icon, label, href, title }: { on: boolean; icon: string; label: string; href: string; title: string }) {
  const style: React.CSSProperties = on
    ? { background: "var(--ds-brand-soft)", border: "1px solid color-mix(in srgb, var(--ds-brand) 33%, transparent)", color: GREEN }
    : { background: "transparent", border: "1px dashed var(--ds-border-default)", color: DIM };
  return (
    <a href={href} title={title} style={{ ...style, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "3px 9px", fontSize: 11.5, fontWeight: 500, lineHeight: 1.4, whiteSpace: "nowrap" }}>
      <span aria-hidden>{icon}</span>
      <span>{on ? label : `Add ${label}`}</span>
      {on && <span aria-hidden style={{ fontSize: 10 }}>✓</span>}
    </a>
  );
}

/** Row of grounding pills. Renders one pill per source the caller opts into
 *  (a page whose AI never reads the Brand Brain passes showBrand={false} so it
 *  doesn't invite a source it won't use). A green pill means the source is
 *  feeding the model; a muted pill invites setup when it's missing. */
export function GroundingChips({ brand, strategy, showBrand = true, showStrategy = true }: { brand: boolean; strategy: boolean; showBrand?: boolean; showStrategy?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }} aria-label="What the AI is grounded in">
      <span style={{ fontSize: 11, color: DIM, fontWeight: 500 }}>Grounded in:</span>
      {showBrand && <Pill on={brand} icon="🧠" label="Brand Brain" href={CANONICAL_ROUTES.campaignStudioBrand} title={brand ? "Generation uses your saved Brand Brain — voice, audience and facts." : "No Brand Brain yet. Set it up so the AI writes in your real voice."} />}
      {showStrategy && <Pill on={strategy} icon="🧭" label="Strategy" href={CANONICAL_ROUTES.business} title={strategy ? "Generation uses your Business-OS strategy — goal, gaps and current growth constraint." : "No Business strategy yet. Define it so the AI aims at your actual goal and constraint."} />}
    </div>
  );
}
