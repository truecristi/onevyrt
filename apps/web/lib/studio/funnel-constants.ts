/**
 * Pure UI constants for the funnel studio — edge-line styles, the per-block
 * checklist preset, the forecast-period lens multipliers, webhook/activity
 * labels, and the loop/tool/nav mode tables. Extracted from funnel-studio.tsx
 * so the constants live in one small, dependency-light module. No JSX, no state.
 */
import { type EdgeLineType } from "@onevyrt/engine";
import { type Mode, type NavSection } from "./types";

export const EDGE_LINE_STYLE: Record<EdgeLineType, { stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
  primary: { stroke: "var(--border3)", strokeWidth: 1.6 },
  secondary: { stroke: "var(--dim)", strokeWidth: 1.3, strokeDasharray: "5 4" },
  conditional: { stroke: "#d97706", strokeWidth: 1.4, strokeDasharray: "1.5 4" },
};
export const EDGE_LINE_LABEL: Record<EdgeLineType, string> = { primary: "Primary", secondary: "Secondary", conditional: "Conditional" };
// Starter readiness items per block kind — original phrasing, generic launch
// fundamentals. "Preset checklist for all blocks" seeds these onto every
// node at once instead of the user writing the same items node by node.
export const BLOCK_CHECKLIST_PRESET: Record<string, string[]> = {
  traffic: ["Tracking pixel / UTM confirmed on this source", "Budget and targeting reviewed"],
  step: ["Page copy finalized", "Page tested on mobile"],
  offer: ["Checkout tested end-to-end", "Payment processor confirmed"],
  split: ["Branch logic reviewed"],
};
// The model's stored numbers have always meant "per month" (same assumption
// the Traffic Forecast panel's period selector uses). This top-bar picker is
// a non-destructive display lens over the KPI cards — PLAN totals only
// (ACTUAL shows real numbers, never scaled); rates like ROAS/CPA/AOV are
// left alone since they don't change with the window you're looking through.
export type DatePeriod = "today" | "yesterday" | "last_7" | "last_30" | "this_month" | "last_month" | "custom";
export const DATE_PERIOD_LABEL: Record<DatePeriod, string> = {
  today: "Today", yesterday: "Yesterday", last_7: "Last 7 Days", last_30: "Last 30 Days",
  this_month: "This Month", last_month: "Last Month", custom: "Custom Range",
};
export const DATE_PERIOD_MULT: Record<DatePeriod, number> = {
  today: 1 / 30, yesterday: 1 / 30, last_7: 7 / 30, last_30: 1, this_month: 1, last_month: 1, custom: 1,
};
/*
  Ported from ONEVYRT's design system: the dark values match its dashboard
  shell (slate-950/900/800 with an emerald accent), the light values match
  its canvas/model-centre "gear" theme (--gear-* tokens in globals.css).
*/
// Mirrors lib/webhooks.ts's WEBHOOK_EVENT_TYPES — kept as a plain client-side
// constant rather than imported, since that module pulls in the Postgres
// client (lib/db.ts) which can't be bundled into a "use client" component.
export const WEBHOOK_EVENT_TYPES = ["project.created", "project.deleted"] as const;
export const ACTIVITY_LABEL: Record<string, string> = {
  "project.create": "Created project", "project.save": "Saved a snapshot", "project.delete": "Deleted project",
  "comment.add": "Commented", "member.add": "Added member", "member.remove": "Removed member", "workspace.rename": "Renamed workspace",
};
/* Combined loop: REVIEW folds VARIANCE + MEASURE into one stage (both are
   plan-vs-actual comparisons, just diagnosis vs. scoreboard framing), and
   CALIBRATE is no longer a stop of its own — it's the act of looping back
   into PLAN, reachable straight from DECIDE. Five stages, same underlying
   features (report export, calibration proposals) one click deeper. */
export const LOOP_STAGES: { n: number; m: Mode; label: string; blurb: string; hue: string; term: string }[] = [
  { n: 1, m: "plan", label: "PLAN", blurb: "Your best-guess numbers for every step of the funnel.", hue: "#2563eb", term: "stagePlan" },
  { n: 2, m: "actual", label: "ACTUAL", hue: "#16a34a", blurb: "Type in what really happened — your real numbers.", term: "stageActual" },
  { n: 3, m: "variance", label: "REVIEW", hue: "#d97706", blurb: "See where real life beat or missed your plan.", term: "stageReview" },
  { n: 4, m: "simulate", label: "TEST A FIX", hue: "#7c3aed", blurb: "Try a change here before you commit to it.", term: "stageSimulate" },
  { n: 5, m: "decide", label: "DECIDE", hue: "#0f766e", blurb: "Pick what to do, and fold it back into the plan.", term: "stageDecide" },
];
// Collapsed behind "More" until there's a reason to open them — see the
// loop stepper render, which auto-expands if `mode` is already one of these
// (e.g. a page refresh mid-Review shouldn't strand the user off-screen).
export const ADVANCED_STAGE_MODES = new Set<Mode>(["variance", "simulate", "decide"]);
export const TOOL_MODES: { m: Mode; label: string; term: string }[] = [
  // "Scenarios" here is a saved, named what-if library — deliberately not
  // called just "Scenarios" anymore, since the loop stage above is called
  // "SIMULATE" and does something different (one ad-hoc candidate vs the
  // live plan); the near-identical names were the actual source of the
  // "why is Simulate empty" confusion, not a bug in either feature.
  { m: "model", label: "Model", term: "modelCentre" }, { m: "scenarios", label: "Saved Scenarios", term: "savedScenarios" }, { m: "solve", label: "Goal Solver", term: "goalSolver" },
];

// Start / Run / Improve: the coarse three-way grouping every mode above
// falls under, shown as a persistent strip in the header (same one the
// Command Centre uses) so there's always a visible answer to "where am I."
// Doesn't change what any mode does or how it's reached — Plan/Actual/
// Review/Simulate/Decide keep their existing 5-stage stepper untouched;
// this is purely an outer label plus a quick-jump into each bucket.
export const NAV_SECTION_OF: Record<Mode, NavSection> = {
  plan: "start",
  actual: "run", variance: "run",
  simulate: "improve", decide: "improve", model: "improve", scenarios: "improve", solve: "improve",
  calibrate: "run", report: "improve",
};
export const NAV_SECTION_DEFAULT: Record<NavSection, Mode> = { start: "plan", run: "actual", improve: "simulate" };
