/**
 * Weekly streak — the momentum half of "What moved this week". A solo founder
 * keeps going when they can see a run building. Each week that something moved
 * forward (a lead, a booked call, a setup essential — any positive delta), the
 * streak grows; a quiet week resets it. We also remember their best run, so a
 * reset still leaves something to beat.
 *
 * Pure and server-free: the record shape + the transition live here so the home
 * card and unit tests share one source of truth. Time comes in as ISO strings
 * so it's deterministic. Pairs with weekly-moved.ts (which decides whether the
 * week "moved") and rolls on the same weekly baseline.
 */

export interface StreakRecord {
  /** Consecutive weeks with forward movement, counting the current one. */
  weeks: number;
  /** Longest run ever reached. */
  best: number;
  /** ISO timestamp of the baseline whose week was last scored. */
  lastScoredAt?: string;
}

export const EMPTY_STREAK: StreakRecord = { weeks: 0, best: 0 };

export interface StreakUpdate {
  record: StreakRecord;
  /** How the just-scored week changed the streak, for a one-time nudge. */
  event: "extended" | "reset" | "started" | "none";
}

/**
 * Score a completed week onto the streak. Call this exactly once per weekly
 * baseline roll (when weekly-moved's shouldResetBaseline fires), passing whether
 * that ending week saw any forward movement. `endedAt` is the baseline the week
 * belonged to — used to ignore a double-score of the same week.
 */
export function scoreWeek(prev: StreakRecord | null | undefined, moved: boolean, endedAt: string): StreakUpdate {
  const base: StreakRecord = prev ? { ...prev } : { ...EMPTY_STREAK };
  // Guard against scoring the same baseline twice (e.g. two loads in one week).
  if (base.lastScoredAt && base.lastScoredAt === endedAt) {
    return { record: base, event: "none" };
  }
  if (moved) {
    const weeks = base.weeks + 1;
    const best = Math.max(base.best, weeks);
    return { record: { weeks, best, lastScoredAt: endedAt }, event: base.weeks === 0 ? "started" : "extended" };
  }
  // A quiet week ends the run — but only counts as a "reset" if there was one.
  const hadRun = base.weeks > 0;
  return { record: { weeks: 0, best: base.best, lastScoredAt: endedAt }, event: hadRun ? "reset" : "none" };
}

/** A short human label for the current streak, or "" when there's nothing to show. */
export function streakLabel(r: StreakRecord | null | undefined): string {
  if (!r || r.weeks <= 0) return "";
  return `${r.weeks}-week streak`;
}
