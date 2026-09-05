import type { Database } from "@onevyrt/database";
import type { ExperimentDecision } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { listGoals, type GoalRecord } from "./business-core-use-cases";
import { listTasks, type TaskRecord } from "./task-use-cases";
import { listExperiments, type ExperimentRecord } from "./experiment-use-cases";
import { listBusinessMetrics, type BusinessMetricRecord } from "./business-metric-use-cases";

/**
 * PRD-REVIEW-001 vertical slice: scorecards (README "Review and
 * intelligence" -> "Scorecards", first slice of Phase 7). Not a new
 * source of truth - a single read-only aggregation over a workspace's
 * existing goals, tasks, experiments and business metrics, each already
 * scoped and authorized by its own list use case (the same "aggregation,
 * never a new source of truth" reasoning as
 * financial-dashboard-use-cases.ts's PRD-NUMBERS-005, applied to a
 * different lens on the data: financial-dashboard is money-shaped
 * (offers, scenarios, assumptions); a scorecard is
 * accountability-shaped - is the work getting done, are experiments
 * reaching a decision, are metrics moving the right direction. Every
 * count and rate here is derived directly from those same lists, never
 * invented or estimated.
 */

export interface GoalScorecardSummary {
  total: number;
  active: number;
  achieved: number;
  abandoned: number;
  /** achieved / total, 0 when there are no goals yet - never divides by zero. */
  achievementRate: number;
}

export interface TaskScorecardSummary {
  total: number;
  open: number;
  inProgress: number;
  done: number;
  /** done / total, 0 when there are no tasks yet. */
  completionRate: number;
  /** Not done and past its due date, as of the moment this scorecard is computed - never persisted, so this is always current rather than stale. */
  overdueCount: number;
}

export interface ExperimentScorecardSummary {
  total: number;
  planned: number;
  running: number;
  completed: number;
  abandoned: number;
  /** Every ExperimentDecision key is present, defaulting to 0 - callers never have to guess which decisions this workspace happens to have used. */
  decisionCounts: Record<ExperimentDecision, number>;
}

export interface BusinessMetricProgress {
  id: string;
  name: string;
  unit: string;
  /** Fraction of the distance from baseline to target the current value has covered, clamped to [0, 1]; null when baseline, target or current is missing, or baseline equals target (progress toward an unmoving target is undefined, not zero). */
  progress: number | null;
}

export interface MetricScorecardSummary {
  total: number;
  /** Metrics with baseline, target and current all set, so progress is computable at all. */
  measurable: number;
  metrics: BusinessMetricProgress[];
}

export interface WorkspaceScorecardRecord {
  workspaceId: string;
  goals: GoalScorecardSummary;
  tasks: TaskScorecardSummary;
  experiments: ExperimentScorecardSummary;
  metrics: MetricScorecardSummary;
}

export interface GetWorkspaceScorecardInput {
  actorUserId: string;
  workspaceId: string;
}

const EXPERIMENT_DECISIONS: ExperimentDecision[] = [
  "adopt",
  "iterate",
  "retest",
  "stop",
  "insufficient_evidence",
  "reject",
];

function summarizeGoals(goals: GoalRecord[]): GoalScorecardSummary {
  const active = goals.filter((g) => g.status === "active").length;
  const achieved = goals.filter((g) => g.status === "achieved").length;
  const abandoned = goals.filter((g) => g.status === "abandoned").length;
  return {
    total: goals.length,
    active,
    achieved,
    abandoned,
    achievementRate: goals.length === 0 ? 0 : achieved / goals.length,
  };
}

function summarizeTasks(tasks: TaskRecord[], now: Date): TaskScorecardSummary {
  const open = tasks.filter((t) => t.status === "open").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const overdueCount = tasks.filter(
    (t) => t.status !== "done" && t.dueDate !== null && t.dueDate < now,
  ).length;
  return {
    total: tasks.length,
    open,
    inProgress,
    done,
    completionRate: tasks.length === 0 ? 0 : done / tasks.length,
    overdueCount,
  };
}

function summarizeExperiments(experiments: ExperimentRecord[]): ExperimentScorecardSummary {
  const decisionCounts = Object.fromEntries(
    EXPERIMENT_DECISIONS.map((decision) => [decision, 0]),
  ) as Record<ExperimentDecision, number>;
  for (const experiment of experiments) {
    if (experiment.decision !== null) {
      decisionCounts[experiment.decision] += 1;
    }
  }
  return {
    total: experiments.length,
    planned: experiments.filter((e) => e.status === "planned").length,
    running: experiments.filter((e) => e.status === "running").length,
    completed: experiments.filter((e) => e.status === "completed").length,
    abandoned: experiments.filter((e) => e.status === "abandoned").length,
    decisionCounts,
  };
}

/**
 * Direction-aware progress toward target - schema.ts's businessMetrics
 * table records whether a rising value is good ("increase", e.g.
 * revenue) or bad ("decrease", e.g. churn), so "progress" always means
 * "distance covered from baseline toward target," never assumes bigger
 * is better.
 */
function computeMetricProgress(metric: BusinessMetricRecord): number | null {
  if (
    metric.baselineValue === null ||
    metric.targetValue === null ||
    metric.currentValue === null
  ) {
    return null;
  }
  const denominator =
    metric.direction === "increase"
      ? metric.targetValue - metric.baselineValue
      : metric.baselineValue - metric.targetValue;
  if (denominator === 0) {
    return null;
  }
  const numerator =
    metric.direction === "increase"
      ? metric.currentValue - metric.baselineValue
      : metric.baselineValue - metric.currentValue;
  return Math.max(0, Math.min(1, numerator / denominator));
}

function summarizeMetrics(metrics: BusinessMetricRecord[]): MetricScorecardSummary {
  const progress: BusinessMetricProgress[] = metrics.map((metric) => ({
    id: metric.id,
    name: metric.name,
    unit: metric.unit,
    progress: computeMetricProgress(metric),
  }));
  return {
    total: metrics.length,
    measurable: progress.filter((m) => m.progress !== null).length,
    metrics: progress,
  };
}

export async function getWorkspaceScorecard(
  db: Database,
  input: GetWorkspaceScorecardInput,
): Promise<WorkspaceScorecardRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const [goals, tasks, experiments, metrics] = await Promise.all([
    listGoals(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
    listTasks(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
    listExperiments(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
    listBusinessMetrics(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
  ]);

  return {
    workspaceId: input.workspaceId,
    goals: summarizeGoals(goals),
    tasks: summarizeTasks(tasks, new Date()),
    experiments: summarizeExperiments(experiments),
    metrics: summarizeMetrics(metrics),
  };
}
