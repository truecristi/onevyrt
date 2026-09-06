/**
 * Stalled learner detection — identifies cohort members who have gone quiet or
 * are stuck on a specific module/lesson, with detailed stall reasons and urgency
 * scoring. Extends lib/coach/engagement.ts with lesson-level granularity and
 * cohort-scoped batch operations.
 *
 * Checks three activity axes:
 *   1. Lesson submissions (submittedAt, reviewStatus)
 *   2. Tool access (activity log: funnel/campaign opens, changes)
 *   3. Dashboard logins (activity log: any platform presence)
 *
 * Returns cohorts with members grouped by stall urgency: members inactive >3d,
 * >7d, >14d, with specific reasons: stuck on module, no submissions since start,
 * quiet (no activity), never started.
 */

import { pgPool } from "../db";
import { listAllWorkspaces } from "../workspaces";
import { getDefaultProgramme } from "../curriculum-store";
import { summarizeEnrollment, nextAction, type Enrollment } from "@onevyrt/engine";
import { daysSince } from "./engagement";
import { listCohortsForCoach, type Cohort } from "../cohorts";

/** Reasons a learner is stalled — hierarchical severity from worst to least. */
export type StallReason =
  | "stuck_on_module"       // Submitted work on a module but hasn't moved on
  | "no_submissions"        // Never submitted any work despite being available
  | "never_started"         // Enrolled but no activity at all
  | "quiet"                 // Had activity but gone silent >7 days
  | "dormant";              // Extremely quiet >14 days

export interface StalledMember {
  workspaceId: string;
  workspaceName: string;
  percentComplete: number;
  currentModuleId: string | null;
  currentModuleName: string | null;
  /** Primary stall reason — why this learner needs attention. */
  reason: StallReason;
  /** Last activity on platform (any action: lessons, tools, login). */
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
  /** How many days without a lesson submission. */
  daysSinceSubmission: number | null;
  /** Lessons awaiting coach review. */
  awaitingReviewCount: number;
  /** Lessons with changes requested. */
  changesRequestedCount: number;
  /** Urgency score (1–1000), higher = more urgent. */
  urgencyScore: number;
}

export interface StalledCohortReport {
  cohortId: string;
  cohortName: string;
  coachEmail: string;
  totalMembers: number;
  stalledCount: number;
  /** Members grouped by inactivity level. */
  inactive3Days: StalledMember[];
  inactive7Days: StalledMember[];
  inactive14Days: StalledMember[];
  /** All stalled members, sorted by urgencyScore (descending). */
  all: StalledMember[];
}

/**
 * Determine the primary stall reason for a learner. Reads as a decision tree:
 * never started > stuck on module > no submissions > dormant > quiet.
 */
export function classifyStallReason(opts: {
  percentComplete: number;
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
  daysSinceSubmission: number | null;
  awaitingReviewCount: number;
  currentModuleId: string | null;
  hasEverSubmitted: boolean;
  now?: number;
}): StallReason {
  const days = opts.daysSinceActivity ?? 0;

  // Never started — enrolled but zero activity
  if (opts.percentComplete === 0 && !opts.lastActivityAt) {
    return "never_started";
  }

  // Stuck on module — has made progress but unchanged for >7d and there's pending work
  if (opts.currentModuleId && opts.awaitingReviewCount > 0 && days >= 7) {
    return "stuck_on_module";
  }

  // No submissions — started but never submitted despite being past first lesson
  if (opts.percentComplete > 0 && !opts.hasEverSubmitted && days >= 3) {
    return "no_submissions";
  }

  // Dormant — gone completely quiet for 3+ weeks
  if (days >= 21) {
    return "dormant";
  }

  // Quiet — absent 7–20 days
  if (days >= 7) {
    return "quiet";
  }

  // Fallback (shouldn't reach here if called correctly)
  return "quiet";
}

/**
 * Score urgency on a 1–1000 scale. Absence outranks pending reviews; extreme
 * inactivity (>21d) scores highest; recent stalls (<3d) score lower.
 *
 * Base scoring:
 * - never_started: 400 (strong re-engagement signal)
 * - stuck_on_module: 350 + (daysInactive * 10) (actively stalled, needs coaching)
 * - no_submissions: 250 + (daysInactive * 5) (lagging, not committed)
 * - dormant: 900 + (daysInactive - 21) * 5 (critical)
 * - quiet: 600 + (daysInactive - 7) * 8 (high attention)
 *
 * Boosters:
 * + awaitingReviewCount * 30 (pending work is high-touch)
 * + (percentComplete * 5) if >0 (stronger signal: they started, now stalled)
 */
export function scoreUrgency(opts: {
  reason: StallReason;
  daysSinceActivity: number | null;
  awaitingReviewCount: number;
  percentComplete: number;
}): number {
  const days = opts.daysSinceActivity ?? 0;
  let score = 0;

  // Base by reason
  switch (opts.reason) {
    case "never_started":
      score = 400;
      break;
    case "stuck_on_module":
      score = 350 + Math.min(days * 10, 400); // Cap at 750
      break;
    case "no_submissions":
      score = 250 + Math.min(days * 5, 300); // Cap at 550
      break;
    case "quiet":
      score = 600 + Math.min((days - 7) * 8, 300); // Cap at 900
      break;
    case "dormant":
      score = 900 + Math.min((days - 21) * 5, 100); // Cap at 1000
      break;
  }

  // Boost for pending reviews (coach has feedback waiting)
  score += opts.awaitingReviewCount * 30;

  // Boost if they have progress (stronger signal to re-engage)
  if (opts.percentComplete > 0) {
    score += opts.percentComplete * 5;
  }

  // Cap at 1000
  return Math.min(Math.floor(score), 1000);
}

/**
 * Detect stalled learners in a single cohort. Returns detailed report per member,
 * with activity tracking from the `activity` table and submission history from
 * enrollments.
 *
 * Performance: O(cohort members), batch-reads activity and enrollments.
 */
export async function detectStalledInCohort(cohort: Cohort): Promise<StalledCohortReport> {
  // Fetch all workspace objects for name mapping
  const allWorkspaces = await listAllWorkspaces();
  const wsById = new Map(allWorkspaces.map((ws) => [ws.id, ws]));

  // Fetch enrollments for all cohort members
  const enrRes = await pgPool().query<{ workspace_id: string; enrollment: Enrollment }>(
    "SELECT workspace_id, enrollment FROM enrollments WHERE workspace_id = ANY($1)",
    [cohort.memberWorkspaceIds],
  );
  const enrollmentByWsId = new Map(enrRes.rows.map((row) => [row.workspace_id, row.enrollment]));

  // Batch-fetch last activity per workspace
  const actRes = cohort.memberWorkspaceIds.length
    ? (await pgPool().query<{ ws_id: string; at: Date }>(
        "SELECT ws_id, max(at) AS at FROM activity WHERE ws_id = ANY($1) GROUP BY ws_id",
        [cohort.memberWorkspaceIds],
      )).rows
    : [];
  const lastActivityByWsId = new Map(actRes.map((row) => [row.ws_id, (row.at as Date).toISOString()]));

  // Get curriculum for lesson lookup
  const programme = await getDefaultProgramme();

  // Classify each member
  const stalled: StalledMember[] = [];
  const now = Date.now();

  for (const wsId of cohort.memberWorkspaceIds) {
    const ws = wsById.get(wsId);
    const enrollment = enrollmentByWsId.get(wsId);

    if (!ws || !enrollment) continue; // Workspace deleted or enrollment not found

    const summary = summarizeEnrollment(programme, enrollment);
    const lastActivityAt = lastActivityByWsId.get(wsId) ?? null;
    const daysSinceActivity = daysSince(lastActivityAt, now);

    // Compute days since last submission
    let lastSubmissionAt: string | null = null;
    let hasEverSubmitted = false;
    for (const lesson of enrollment.lessons) {
      for (const sub of lesson.submissions) {
        hasEverSubmitted = true;
        if (!lastSubmissionAt || new Date(sub.submittedAt) > new Date(lastSubmissionAt)) {
          lastSubmissionAt = sub.submittedAt;
        }
      }
    }
    const daysSinceSubmission = daysSince(lastSubmissionAt, now);

    // Find current module (respects the cohort's pacing cap, same as the
    // learner's own "continue programme" CTA and the admin roster).
    const next = nextAction(programme, enrollment, cohort.stageAccessLimit);
    const currentModuleId = next.currentLessonId;
    const currentModuleName = next.currentLessonTitle;

    const reason = classifyStallReason({
      percentComplete: summary.percentComplete,
      lastActivityAt,
      daysSinceActivity,
      daysSinceSubmission,
      awaitingReviewCount: summary.awaitingReview.length,
      currentModuleId,
      hasEverSubmitted,
      now,
    });

    // Only include if actually stalled (inactivity >3d or awaiting review while quiet)
    const isStalled =
      (daysSinceActivity !== null && daysSinceActivity >= 3) ||
      (reason === "never_started") ||
      (reason === "stuck_on_module");

    if (!isStalled) continue;

    const urgencyScore = scoreUrgency({
      reason,
      daysSinceActivity,
      awaitingReviewCount: summary.awaitingReview.length,
      percentComplete: summary.percentComplete,
    });

    stalled.push({
      workspaceId: wsId,
      workspaceName: ws.name,
      percentComplete: summary.percentComplete,
      currentModuleId,
      currentModuleName,
      reason,
      lastActivityAt,
      daysSinceActivity,
      daysSinceSubmission,
      awaitingReviewCount: summary.awaitingReview.length,
      changesRequestedCount: summary.changesRequested.length,
      urgencyScore,
    });
  }

  // Sort by urgency (descending) and group by inactivity level
  stalled.sort((a, b) => b.urgencyScore - a.urgencyScore);

  const inactive3Days = stalled.filter((m) => m.daysSinceActivity !== null && m.daysSinceActivity >= 3);
  const inactive7Days = stalled.filter((m) => m.daysSinceActivity !== null && m.daysSinceActivity >= 7);
  const inactive14Days = stalled.filter((m) => m.daysSinceActivity !== null && m.daysSinceActivity >= 14);

  return {
    cohortId: cohort.id,
    cohortName: cohort.name,
    coachEmail: cohort.coachEmail,
    totalMembers: cohort.memberWorkspaceIds.length,
    stalledCount: stalled.length,
    inactive3Days,
    inactive7Days,
    inactive14Days,
    all: stalled,
  };
}

/**
 * Detect stalled learners across all cohorts a coach owns. Useful for the
 * coach's dashboard "who's quiet" view and digest emails.
 *
 * @param coachUserId — the coach's user id
 * @param opts.cohorts — cohort roster (pre-fetched); if omitted, queries all cohorts
 * @returns all stalled members grouped by cohort
 */
export async function detectStalledAcrossCohorts(
  coachUserId: string,
  opts?: { cohorts?: Cohort[] },
): Promise<StalledCohortReport[]> {
  const cohorts = opts?.cohorts ?? (await listCohortsForCoach(coachUserId));

  return Promise.all(cohorts.map((cohort) => detectStalledInCohort(cohort)));
}

/**
 * Helper: filter a StalledCohortReport to members matching specific criteria.
 * Useful for generating targeted alerts (e.g., "who's been offline >14 days").
 */
export function filterByCriteria(
  report: StalledCohortReport,
  opts: {
    minDaysSince?: number;
    maxDaysSince?: number;
    reasons?: StallReason[];
    minUrgency?: number;
  },
): StalledMember[] {
  return report.all.filter((m) => {
    if (opts.minDaysSince && (m.daysSinceActivity === null || m.daysSinceActivity < opts.minDaysSince)) {
      return false;
    }
    if (opts.maxDaysSince && (m.daysSinceActivity === null || m.daysSinceActivity > opts.maxDaysSince)) {
      return false;
    }
    if (opts.reasons && !opts.reasons.includes(m.reason)) {
      return false;
    }
    if (opts.minUrgency && m.urgencyScore < opts.minUrgency) {
      return false;
    }
    return true;
  });
}
