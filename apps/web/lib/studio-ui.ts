/**
 * Shared visual primitives and small pure helpers used across the studio's
 * extracted panel components (ModelCentre, ProgramCentre, the modals, etc.)
 * and funnel-studio.tsx itself. Pulled out so those components can live in
 * their own files without importing back from funnel-studio.tsx, which would
 * be circular (funnel-studio.tsx renders them).
 */
import type { CSSProperties } from "react";
import { formatMoney, allKinds, fieldsFor, capabilityOf, type FieldDef } from "@onevyrt/engine";

export type FieldSpec = FieldDef;

// Theme-aware brand accent. Was a hard-wired dark-green literal (#088057)
// used as FOREGROUND text/border across ~40 studio sites, which failed WCAG
// AA contrast on the dark theme's near-black surfaces. It's now the
// --accent CSS var (light #088057, dark #30D158 — see lib/studio/theme-css.ts),
// with the old literal as a fallback for any context where data-theme hasn't
// been stamped yet. Every consumer uses it as a CSS value (color, border,
// background), so a var() string is a drop-in.
export const ACCENT = "var(--accent, #088057)";

// A FIXED dark green for use as a BACKGROUND under white text (primary
// buttons, filled chips). The theme-aware --accent flips bright in dark mode
// (#30D158) so it reads as accent-coloured *text/borders* on dark surfaces —
// but white text on that bright green fails WCAG AA (~1.75:1). This solid
// green keeps white-on-accent buttons at ~4.95:1 in BOTH themes, since the
// contrast is between the text and its own background, independent of theme.
export const ACCENT_SOLID = "#088057";

/** Shared shell for every floating side panel (Risk, Constraints, History,
 *  Comments, AI Copilot, ...): a frosted-glass card, softly shadowed, that
 *  reads as one consistent system instead of ad hoc popovers. */
export function glassPanel(width: number): CSSProperties {
  return {
    position: "fixed", top: 60, right: 16, width, maxWidth: "94vw", maxHeight: "82vh",
    display: "flex", flexDirection: "column",
    background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
    borderRadius: 21, zIndex: 60, boxShadow: "var(--shadow-panel)",
  };
}
export const GLASS_PANEL_CLASS = "gb-glass-panel";
export const barBtn = { background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text)", borderRadius: 11, padding: "6px 13px", fontSize: 13, cursor: "pointer" } as const;
export const barGhost = { background: "transparent", border: "1px solid var(--border2)", color: "var(--muted)", borderRadius: 11, padding: "6px 13px", fontSize: 13, cursor: "pointer" } as const;
// Uses ACCENT_SOLID (not the theme-aware ACCENT) so white text stays AA on it
// in dark mode — see the ACCENT_SOLID note above.
export const barPrimary = { background: ACCENT_SOLID, border: `1px solid ${ACCENT_SOLID}`, color: "#fff", borderRadius: 11, padding: "6px 15px", fontSize: 13, fontWeight: 500, cursor: "pointer", boxShadow: "0 1px 2px rgba(10,158,110,0.32)" } as const;

/** A real 36×36 tap target for icon-only controls (layer toggles, the canvas
 *  toolbar, ...) — `barGhost` at padding "3px 7px" measures ~20px tall,
 *  well under any comfortable tap size. `active` swaps in the same
 *  accent-soft treatment every other toggle in the app already uses. */
export function iconBtn(active = false): CSSProperties {
  return {
    width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
    background: active ? "var(--accent-soft)" : "transparent",
    border: `1px solid ${active ? ACCENT : "transparent"}`,
    color: active ? ACCENT : "var(--muted)",
    borderRadius: 11, fontSize: 15, cursor: "pointer", flexShrink: 0,
  };
}

export const KIND_COLOR: Record<string, string> = Object.fromEntries(allKinds().map((k) => [k, capabilityOf(k)!.color]));
export const KIND_ICON: Record<string, string> = { traffic: "◎", step: "▤", offer: "◈", split: "⑂" };
export const FIELDS_BY_KIND: Record<string, FieldSpec[]> = Object.fromEntries(allKinds().map((k) => [k, fieldsFor(k)]));

export function fromEngine(unit: FieldSpec["unit"], v: number): number {
  return unit === "rate" ? v * 100 : unit === "money" ? v / 100 : v;
}
export function toEngineValue(unit: FieldSpec["unit"], display: number): number {
  return unit === "rate" ? display / 100 : unit === "money" ? Math.round(display * 100) : display;
}

// The studio's KPI cards, library cards, and panels all format money in
// "whatever currency the current funnel uses" without threading a currency
// prop through every leaf component — so this is deliberately a module-level
// mutable value, set once per render from StudioInner, the same pattern the
// pre-extraction code used. setActiveCurrency is the only way to change it:
// a plain imported binding can't be reassigned from outside this module.
let activeCurrency = "USD";
export function setActiveCurrency(code: string): void { activeCurrency = code; }
export const money = (m: number): string => formatMoney(m, activeCurrency);
export const num = (n: number): string => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
export const signedMoney = (m: number): string => (m >= 0 ? "+" : "-") + formatMoney(Math.abs(m), activeCurrency);
export const signedPct = (p: number): string => (p >= 0 ? "+" : "") + (p * 100).toFixed(0) + "%";
