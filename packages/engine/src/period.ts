/**
 * Period: the window a set of ACTUAL numbers belongs to.
 *
 * A plan is timeless — it describes a funnel, not a month. Actuals are not:
 * "$40,000 revenue" means nothing until you know whether that was a week or a
 * quarter. This module turns a start/end pair into a day count, and a day count
 * into run-rate, so two periods of different lengths can be compared honestly.
 *
 * Pure and dependency-free. Dates are ISO calendar days ("2026-07-15"), never
 * timestamps — a funnel's reporting period is a business concept, not an instant,
 * and must not shift under a timezone.
 */
import type { Minor } from "./money.ts";
import { FunnelError } from "./types.ts";

export interface Period {
  /** Inclusive ISO start date, e.g. "2026-07-01". */
  start: string;
  /** Inclusive ISO end date, e.g. "2026-07-31". */
  end: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Parse an ISO calendar day to UTC midnight, or null if it isn't a real date. */
function parseDay(s: string): number | null {
  if (!ISO_DAY.test(s)) return null;
  const ms = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  // reject impossible days that Date.parse would roll over (e.g. 2026-02-31)
  const d = new Date(ms);
  if (d.toISOString().slice(0, 10) !== s) return null;
  return ms;
}

export function isValidPeriod(p: Period | null | undefined): boolean {
  if (!p) return false;
  const a = parseDay(p.start);
  const b = parseDay(p.end);
  return a !== null && b !== null && a <= b;
}

export function validatePeriod(p: Period): void {
  if (parseDay(p.start) === null) throw new FunnelError("BAD_PERIOD", `period.start is not an ISO date: ${p.start}`);
  if (parseDay(p.end) === null) throw new FunnelError("BAD_PERIOD", `period.end is not an ISO date: ${p.end}`);
  if (parseDay(p.start)! > parseDay(p.end)!) throw new FunnelError("BAD_PERIOD", "period.start must be on or before period.end");
}

/** Inclusive day count: a single-day period is 1 day, not 0. */
export function periodDays(p: Period): number {
  validatePeriod(p);
  return Math.round((parseDay(p.end)! - parseDay(p.start)!) / MS_PER_DAY) + 1;
}

/** Per-day run-rate for a money value over the period. */
export function perDay(value: Minor, p: Period): Minor {
  const days = periodDays(p);
  return Math.round(value / days);
}

/** Project a period's money value onto another window, e.g. 7 days -> 30 days. */
export function projectTo(value: Minor, p: Period, days: number): Minor {
  if (!(days > 0)) throw new FunnelError("BAD_PERIOD", "days must be > 0");
  return Math.round(perDay(value, p) * days);
}

/** Human label, e.g. "1 Jul - 31 Jul 2026 (31 days)". */
export function describePeriod(p: Period): string {
  const days = periodDays(p);
  return `${p.start} \u2192 ${p.end} (${days} day${days === 1 ? "" : "s"})`;
}
