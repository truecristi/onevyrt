/**
 * Money Machine Ledger: money-machine.ts computes what SHOULD be set aside
 * each month — a live projection off the current model's profit, never
 * persisted, never checked against reality. This is the missing other half:
 * an actual record of money moved into (or out of) the Security, Growth and
 * Dream buckets, plus an optional target per bucket, so "Freedom Plan"
 * becomes a fund you're really building instead of a formula you glance at.
 * Kept separate from the Decision log (loop.ts) and Experiment/Assumption
 * registers — this is money, not a hypothesis or a plan change. Pure data +
 * pure summary, no UI.
 */
export type LedgerBucket = "security" | "growth" | "dream";
export type LedgerKind = "contribution" | "withdrawal";

export interface LedgerEntry {
  id: string;
  createdAt: string;
  bucket: LedgerBucket;
  kind: LedgerKind;
  /** Minor units, always positive — kind is what determines the sign in a
   *  running balance, not the stored value itself. */
  amount: number;
  note?: string;
}

export interface MoneyMachineTargets {
  securityTarget?: number;
  growthTarget?: number;
  dreamTarget?: number;
  /** ISO date strings — when the bucket should hit its target, not just
   *  how much. Optional: a target amount with no date still works exactly
   *  as before (monthsToTarget's pace-based estimate). */
  securityGoalDate?: string;
  growthGoalDate?: string;
  dreamGoalDate?: string;
}

export interface BucketSummary {
  balance: number;
  target?: number;
  goalDate?: string;
  /** null when no target is set — a bucket with no goal has no "percent
   *  there yet" to report, and 0% would misleadingly imply one exists. */
  progressPct: number | null;
}

export interface LedgerSummary {
  security: BucketSummary;
  growth: BucketSummary;
  dream: BucketSummary;
  totalBalance: number;
}

export function summarizeLedger(entries: readonly LedgerEntry[], targets: MoneyMachineTargets = {}): LedgerSummary {
  const balances: Record<LedgerBucket, number> = { security: 0, growth: 0, dream: 0 };
  for (const e of entries) {
    balances[e.bucket] += e.kind === "contribution" ? e.amount : -e.amount;
  }
  const bucket = (b: LedgerBucket, target?: number, goalDate?: string): BucketSummary => ({
    balance: balances[b],
    target,
    goalDate,
    progressPct: target != null && target > 0 ? Math.min(100, Math.max(0, Math.round((balances[b] / target) * 100))) : null,
  });
  return {
    security: bucket("security", targets.securityTarget, targets.securityGoalDate),
    growth: bucket("growth", targets.growthTarget, targets.growthGoalDate),
    dream: bucket("dream", targets.dreamTarget, targets.dreamGoalDate),
    totalBalance: balances.security + balances.growth + balances.dream,
  };
}

/** Whole months to close the gap to a bucket's target at a steady monthly
 *  contribution rate. null when there's no target, the target's already
 *  met (0, not a negative "months"), or the contribution rate can't ever
 *  get there (zero/negative rate with a real gap remaining). */
export function monthsToTarget(balance: number, target: number | undefined, monthlyContribution: number): number | null {
  if (target == null || target <= 0) return null;
  const gap = target - balance;
  if (gap <= 0) return 0;
  if (monthlyContribution <= 0) return null;
  return Math.ceil(gap / monthlyContribution);
}

/** Whole calendar months between two dates, floored — never negative, so a
 *  `to` on or before `from` reads as 0, not a nonsensical negative count. */
function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return Math.max(0, months);
}

/** The reverse of monthsToTarget(): given a target amount AND a target
 *  date, the steady monthly contribution needed to close the gap by then —
 *  "you've set a date, here's what that actually costs per month," rather
 *  than only ever reporting how many months the CURRENT pace would take.
 *  null when there's no target/date, or the date has already passed with a
 *  real gap still remaining (no schedule can retroactively fix that — the
 *  honest answer is "you're already behind," not a number). */
export function requiredMonthlyContribution(balance: number, target: number | undefined, goalDate: string | undefined, now: Date): number | null {
  if (target == null || target <= 0 || !goalDate) return null;
  const gap = target - balance;
  if (gap <= 0) return 0;
  const parsed = new Date(goalDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const months = monthsBetween(now, parsed);
  if (months <= 0) return null;
  return gap / months;
}
