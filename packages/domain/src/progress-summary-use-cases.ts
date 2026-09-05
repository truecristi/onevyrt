import type { Database } from "@onevyrt/database";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { getWorkspaceScorecard } from "./scorecard-use-cases";
import { listWeeklyReviews, toWeekStart, type WeeklyReviewRecord } from "./weekly-review-use-cases";

/**
 * PRD-REVIEW-005 vertical slice: progress summaries (README "Review and
 * intelligence" -> "Progress summaries", fifth slice of Phase 7).
 * Compares the workspace's *current* scorecard (a fresh, live
 * aggregation - see getWorkspaceScorecard) against the scorecard snapshot
 * frozen in an earlier weekly review (Phase 7 second slice) - the only
 * point-in-time record this schema has for goals/tasks/experiments/
 * metrics history. No other historical reconstruction is attempted: this
 * codebase has no event-sourced history of those tables, and a synthetic
 * one built from audit_log entries would be a much larger, separate
 * effort, not this slice's job.
 *
 * If the workspace has no weekly review far enough back, this honestly
 * reports "no comparison available" (hasComparison: false, every delta
 * null) rather than comparing against whatever happens to be there or
 * inventing a baseline.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DeltaEntry {
  current: number;
  previous: number | null;
  delta: number | null;
}

export interface MetricProgressChange {
  metricId: string;
  name: string;
  currentProgress: number | null;
  previousProgress: number | null;
  delta: number | null;
}

export interface ProgressSummaryRecord {
  workspaceId: string;
  hasComparison: boolean;
  /** The weekStartDate of the weekly review used as the comparison baseline, or null when hasComparison is false. */
  comparisonWeekStartDate: Date | null;
  goalsAchievementRate: DeltaEntry;
  tasksCompletionRate: DeltaEntry;
  experimentsCompleted: DeltaEntry;
  metrics: MetricProgressChange[];
}

export interface GetProgressSummaryInput {
  actorUserId: string;
  workspaceId: string;
  /** How many weeks back to look for a comparison baseline. Defaults to 4. The actual baseline used is the closest saved weekly review at or before that point, not necessarily exactly that week - see comparisonWeekStartDate. */
  weeksBack?: number;
}

function buildDelta(current: number, previous: number | null): DeltaEntry {
  return { current, previous, delta: previous === null ? null : current - previous };
}

export async function getProgressSummary(
  db: Database,
  input: GetProgressSummaryInput,
): Promise<ProgressSummaryRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const weeksBack = input.weeksBack ?? 4;

  const [currentScorecard, reviews] = await Promise.all([
    getWorkspaceScorecard(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
    listWeeklyReviews(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
  ]);

  const targetWeekStart = toWeekStart(new Date(Date.now() - weeksBack * 7 * MS_PER_DAY));
  // reviews is newest-first; the first one at or before the target is the
  // closest available baseline, degrading gracefully if a week was missed.
  const comparisonReview: WeeklyReviewRecord | undefined = reviews.find(
    (r) => r.weekStartDate.getTime() <= targetWeekStart.getTime(),
  );

  const previousGoalsRate = comparisonReview?.scorecardSnapshot.goals.achievementRate ?? null;
  const previousTasksRate = comparisonReview?.scorecardSnapshot.tasks.completionRate ?? null;
  const previousExperimentsCompleted =
    comparisonReview?.scorecardSnapshot.experiments.completed ?? null;

  const previousMetricsById = new Map(
    (comparisonReview?.scorecardSnapshot.metrics.metrics ?? []).map((m) => [m.id, m]),
  );

  const metrics: MetricProgressChange[] = currentScorecard.metrics.metrics.map((metric) => {
    const previousProgress = previousMetricsById.get(metric.id)?.progress ?? null;
    const delta =
      metric.progress === null || previousProgress === null
        ? null
        : metric.progress - previousProgress;
    return {
      metricId: metric.id,
      name: metric.name,
      currentProgress: metric.progress,
      previousProgress,
      delta,
    };
  });

  return {
    workspaceId: input.workspaceId,
    hasComparison: comparisonReview !== undefined,
    comparisonWeekStartDate: comparisonReview?.weekStartDate ?? null,
    goalsAchievementRate: buildDelta(currentScorecard.goals.achievementRate, previousGoalsRate),
    tasksCompletionRate: buildDelta(currentScorecard.tasks.completionRate, previousTasksRate),
    experimentsCompleted: buildDelta(
      currentScorecard.experiments.completed,
      previousExperimentsCompleted,
    ),
    metrics,
  };
}
