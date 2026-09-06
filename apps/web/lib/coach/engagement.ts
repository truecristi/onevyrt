/**
 * Engagement classification — the "who's stuck and why" brain behind the coach
 * roster and the platform-admin learner console. Pure and dependency-free
 * (no DB, no React), so the same rules drive the roster UI, the sort order, and
 * any digest/alert job, and can be unit-tested without a database.
 *
 * The roster already knew who was behind on *reviews*, but ignored plain
 * absence — a learner who vanished three weeks ago with nothing pending sank to
 * the bottom when they're exactly who a coach needs to chase. This makes
 * inactivity a first-class signal (the Cardone-University "why aren't you on the
 * platform?" case) and folds it into one status + one attention weight.
 */

/** A learner is "idle" after this many days with no recorded activity (any
 *  learning OR building action records activity, so this tracks real presence). */
export const IDLE_DAYS = 7;
/** Past this, they've gone properly quiet — the strongest reach-out signal. */
export const DORMANT_DAYS = 21;

export type EngagementStatus =
  | "completed"
  | "on_track"
  | "awaiting_review"
  | "changes_pending"
  | "idle"
  | "dormant"
  | "never_started";

export type EngagementTone = "good" | "info" | "warn" | "danger" | "muted";

/** The minimal slice of a coach-roster client this classifier needs. Kept
 *  structural (not tied to the page's CoachClient type) so server routes and
 *  jobs can pass the same shape. */
export interface EngagementInput {
  percentComplete: number;
  awaitingReviewCount: number;
  changesRequestedCount: number;
  overdueCount: number;
  lastActivityAt: string | null;
}

export interface Engagement {
  status: EngagementStatus;
  /** Short pill text, e.g. "Idle 9d", "Gone quiet 24d", "On track". */
  label: string;
  tone: EngagementTone;
  daysSinceActivity: number | null;
  /** True when this learner needs a human nudge (idle, dormant, or enrolled but
   *  never started). Drives the "N have gone quiet" alert and the reach-out CTA. */
  atRisk: boolean;
  /** Sort weight — higher is more urgent. Absence outranks pending reviews,
   *  which outrank steady progress. */
  attention: number;
}

/** Whole days since an ISO timestamp, or null when there's no timestamp / it's
 *  unparseable. Clamped at 0 so clock skew can't read as "active in the future". */
export function daysSince(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

function mk(status: EngagementStatus, label: string, tone: EngagementTone, daysSinceActivity: number | null, atRisk: boolean, attention: number): Engagement {
  return { status, label, tone, daysSinceActivity, atRisk, attention };
}

/**
 * Reduce a learner's progress + last activity to one engagement status.
 *
 * Priority is deliberate: finished learners drop out; never-started and absent
 * learners rise to the top (they're the reach-out targets); only then do
 * pending-review / changes states apply; steady progress sorts last. The
 * separate awaiting-review / overdue *counts* still show as their own chips on
 * the card — this status is the headline, not a replacement for them.
 */
export function classifyEngagement(c: EngagementInput, now: number = Date.now()): Engagement {
  const d = daysSince(c.lastActivityAt, now);
  const started = c.percentComplete > 0 || d !== null;

  if (c.percentComplete >= 100) return mk("completed", "Completed", "good", d, false, 0);
  if (!started) return mk("never_started", "Not started", "muted", d, true, 400);
  if (d !== null && d >= DORMANT_DAYS) return mk("dormant", `Gone quiet ${d}d`, "danger", d, true, 1000 + d);
  if (d !== null && d >= IDLE_DAYS) return mk("idle", `Idle ${d}d`, "warn", d, true, 600 + d);
  if (c.awaitingReviewCount > 0) return mk("awaiting_review", "Awaiting review", "info", d, false, 200 + c.awaitingReviewCount);
  if (c.changesRequestedCount > 0) return mk("changes_pending", "Changes pending", "warn", d, false, 140);
  if (c.overdueCount > 0) return mk("on_track", "Behind on tasks", "warn", d, false, 80 + c.overdueCount);
  return mk("on_track", "On track", "good", d, false, 10);
}
