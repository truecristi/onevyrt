/** Shared UI-state types used across funnel-studio.tsx and its extracted
 *  inspector/nav components — kept separate so both sides can import them
 *  without a circular dependency on the main studio file. */
export type Mode = "plan" | "model" | "actual" | "variance" | "calibrate" | "decide" | "report" | "scenarios" | "solve" | "simulate";
export type NavSection = "start" | "run" | "improve";
// Inspector tabs, grouped 7 → 3 (audit 2D): Basics (was settings+product),
// Numbers (was results+options), Advanced (was customize+notes+ops).
export type InspTab = "basics" | "numbers" | "advanced";

// Labels for the Start/Run/Improve strip — shared by the TriNav widget and
// StudioInner's own header, so both read the exact same copy.
export const NAV_SECTION_LABEL: Record<NavSection, { label: string; sub: string }> = {
  start: { label: "Start", sub: "Plan the business" },
  run: { label: "Run", sub: "Today, actions, tracking" },
  improve: { label: "Improve", sub: "Model, simulate, decide" },
};
