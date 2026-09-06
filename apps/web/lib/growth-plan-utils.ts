/**
 * Growth & Improvement Plan (Chapter 4 artifact) — pure helpers shared by the
 * API route, the GrowthImprovementPlan component and its page: turning a raw
 * chapter_4_submissions row (lib/chapter4-submissions.ts) into the shape the
 * UI renders (formatPlan), estimating the upside of closing the identified
 * bottleneck (calculateImpactProjection), and sanity-checking metrics before
 * they're saved (validatePlanMetrics). No DB/network access, so these are
 * safe to unit-test and to import from both server and client code.
 */
import type {
  Chapter4Submission, Chapter4Status, Chapter4Subchapter,
  GrowthPlanMetrics, GrowthPlanBottleneck, GrowthPlanAction,
} from "./chapter4-submissions";

export type { GrowthPlanMetrics, GrowthPlanBottleneck, GrowthPlanAction };

/** The "expected 90-day impact" block: a rate moving from current to target
 *  across a fixed volume of opportunities, per
 *  docs/IMPLEMENTATION_ROADMAP.md's worked example (100 leads × 8.2% = 8.2
 *  sales → 100 leads × 12% = 12 sales → +46% revenue potential). */
export interface GrowthPlanImpactProjection {
  leadVolume: number;
  currentRatePct: number;
  targetRatePct: number;
  currentUnits: number;
  targetUnits: number;
  upliftUnits: number;
  /** % change from currentUnits to targetUnits — see
   *  calculateImpactProjection for the exact arithmetic and its assumption. */
  upliftPct: number;
}

/** The fully-resolved shape GrowthImprovementPlan.tsx renders — every
 *  section either populated or explicitly empty/null, so the component never
 *  has to reach into raw submission.data itself. */
export interface GrowthPlan {
  status: Chapter4Status;
  currentPosition: GrowthPlanMetrics;
  bottleneck: GrowthPlanBottleneck | null;
  actions: GrowthPlanAction[];
  impact: GrowthPlanImpactProjection | null;
  completedSubchapters: Chapter4Subchapter[];
  submittedAt: string | null;
  reviewedAt: string | null;
  coachDecision: "approved" | "changes_requested" | null;
  coachFeedback: string | null;
  updatedAt: string;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Estimate the % revenue uplift of moving a rate from `current` to `target`
 * across `volume` opportunities. `current`/`target` are PERCENTAGES (8.2
 * means 8.2%, matching how the bottleneck's rates are collected everywhere
 * else in this feature) — NOT fractions.
 *
 * Assumes average deal value stays constant, so a % lift in unit volume
 * (leads converted) is the same % lift in revenue — the assumption the
 * roadmap's own worked example makes (100 leads × 8.2% → 8.2 "sales", ×12% →
 * 12 "sales", uplift "+46% revenue potential" — computed purely from the
 * rate change, with no separate price figure). Returns 0 rather than
 * NaN/Infinity when there's nothing meaningful to compare against (a
 * non-finite input, or a zero/negative current rate or volume — you can't
 * express an uplift off a baseline of zero).
 */
export function calculateImpactProjection(current: number, target: number, volume: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || !Number.isFinite(volume)) return 0;
  if (current <= 0 || volume <= 0) return 0;
  const currentUnits = volume * (current / 100);
  const targetUnits = volume * (target / 100);
  if (currentUnits <= 0) return 0;
  return Math.round(((targetUnits - currentUnits) / currentUnits) * 100);
}

/** Transform a stored chapter_4_submissions row into the UI-ready GrowthPlan
 *  shape: resolves the impact projection from the bottleneck's rates + the
 *  saved lead volume (all three needed — an incomplete plan just renders
 *  `impact: null`, which the component shows as "not enough data yet" rather
 *  than a wrong or zeroed projection), and normalises every section to a
 *  concrete value (never `undefined`) so the component's rendering logic
 *  only has to check for `null`/empty. */
export function formatPlan(submission: Chapter4Submission): GrowthPlan {
  const { data } = submission;
  const b = data.bottleneck;
  const bottleneck: GrowthPlanBottleneck | null =
    b && (b.area || b.why || b.currentValue !== undefined || b.targetValue !== undefined) ? b : null;

  let impact: GrowthPlanImpactProjection | null = null;
  const leadVolume = data.impact?.leadVolume;
  if (bottleneck?.currentValue !== undefined && bottleneck?.targetValue !== undefined && leadVolume !== undefined && leadVolume > 0) {
    const currentUnits = round1(leadVolume * (bottleneck.currentValue / 100));
    const targetUnits = round1(leadVolume * (bottleneck.targetValue / 100));
    impact = {
      leadVolume,
      currentRatePct: bottleneck.currentValue,
      targetRatePct: bottleneck.targetValue,
      currentUnits,
      targetUnits,
      upliftUnits: round1(targetUnits - currentUnits),
      upliftPct: calculateImpactProjection(bottleneck.currentValue, bottleneck.targetValue, leadVolume),
    };
  }

  return {
    status: submission.status,
    currentPosition: data.currentPosition ?? {},
    bottleneck,
    actions: data.actions ?? [],
    impact,
    completedSubchapters: data.completedSubchapters ?? [],
    submittedAt: submission.submittedAt ?? null,
    reviewedAt: submission.reviewedAt ?? null,
    coachDecision: submission.coachDecision ?? null,
    coachFeedback: submission.coachFeedback ?? null,
    updatedAt: submission.updatedAt,
  };
}

/** Sanity-checks a "current position" metrics object before it's saved:
 *  every field is OPTIONAL (a learner fills these in gradually — a partial
 *  object is valid), but any field that IS present must be a finite number
 *  in a plausible range (revenue/customer value non-negative; margin within
 *  ±100%; conversion rate within 0–100%). `undefined`/`null` is valid input
 *  (nothing to check yet); anything that isn't a plain object is not. */
export function validatePlanMetrics(metrics: Partial<GrowthPlanMetrics> | null | undefined): boolean {
  if (metrics == null) return true;
  if (typeof metrics !== "object") return false;
  const checks: Array<[unknown, (n: number) => boolean]> = [
    [metrics.monthlyRevenue, (n) => n >= 0],
    [metrics.grossMarginPct, (n) => n >= -100 && n <= 100],
    [metrics.conversionRatePct, (n) => n >= 0 && n <= 100],
    [metrics.avgCustomerValue, (n) => n >= 0],
  ];
  for (const [value, inRange] of checks) {
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || !inRange(value)) return false;
  }
  return true;
}

/** A rate (0–100, e.g. a conversion % or the bottleneck's current/target
 *  value) is a finite number in range — the same bar validatePlanMetrics
 *  holds conversionRatePct to, exposed separately since the bottleneck and
 *  impact sections live outside GrowthPlanMetrics. */
export function isValidRate(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
}

/** A count/volume (leads, customers) is a finite, non-negative number. */
export function isValidVolume(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

// ── Display formatting ──────────────────────────────────────────────────
// Kept here (not duplicated in the component) so the artifact and any future
// PDF/share export read the same numbers the same way.

/** £-formatted, no decimals — matches the whole-pound figures in
 *  docs/IMPLEMENTATION_ROADMAP.md's worked example ("£34,500"). */
export function formatCurrency(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

/** A percentage to one decimal place (trailing .0 collapsed), optionally
 *  force-signed for an uplift figure ("+46%" rather than "46%"). */
export function formatPercent(n: number | undefined | null, opts: { signed?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = round1(n);
  const sign = opts.signed && rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}
