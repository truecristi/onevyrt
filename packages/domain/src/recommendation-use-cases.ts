import type { Database } from "@onevyrt/database";
import type { Force } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { getConstraintDiagnosis } from "./force-assessment-use-cases";
import { getExperimentAnalysis } from "./experiment-analysis-use-cases";
import { getWorkspaceScorecard } from "./scorecard-use-cases";

/**
 * PRD-REVIEW-006 vertical slice: recommendation ranking (README "Review
 * and intelligence" -> "Recommendation ranking", sixth slice of Phase
 * 7). A small, deterministic, rule-based ranking over the analytical
 * surfaces this phase already built (getConstraintDiagnosis,
 * getExperimentAnalysis, getWorkspaceScorecard) - not a new source of
 * truth, and deliberately not AI-generated: Phase 6's AI task proposals
 * already cover "suggest a next action grounded in business context"
 * through a model; this is the analytical counterpart that ranks what
 * the numbers themselves already show, with zero model dependency and a
 * rationale a human can verify against the underlying data. The two are
 * complementary, not competing - a future slice could feed one of these
 * recommendations into a task proposal, but that composition is out of
 * this slice's scope.
 *
 * Each rule only fires when its underlying signal actually exists (a
 * primary constraint, a lagging metric, etc.) - a workspace with no
 * data yet gets an empty recommendation list, never a fabricated one.
 */

export type RecommendationSource =
  "constraint_diagnosis" | "overdue_tasks" | "untested_assumptions" | "lagging_metric";

export type RecommendationPriority = "high" | "medium" | "low";

export interface Recommendation {
  source: RecommendationSource;
  title: string;
  rationale: string;
  priority: RecommendationPriority;
  /** The specific record this recommendation is about (a metric id, etc.) - null when the recommendation is about an aggregate signal rather than one record. */
  relatedId: string | null;
}

export interface RecommendationsRecord {
  workspaceId: string;
  /** Sorted by priority (high first); stable within a priority in the fixed rule-evaluation order below, so the ordering is fully deterministic. */
  recommendations: Recommendation[];
}

export interface GetRecommendationsInput {
  actorUserId: string;
  workspaceId: string;
}

const FORCE_LABELS: Record<Force, string> = {
  owner_psychology: "Owner psychology",
  vision_planning: "Vision & planning",
  sales_marketing: "Sales & marketing",
  people_culture: "People & culture",
  operations_systems: "Operations & systems",
  finance_measurement: "Finance & measurement",
  customer_experience: "Customer experience",
};

const PRIORITY_WEIGHT: Record<RecommendationPriority, number> = { high: 3, medium: 2, low: 1 };

export async function getRecommendations(
  db: Database,
  input: GetRecommendationsInput,
): Promise<RecommendationsRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const [diagnosis, experimentAnalysis, scorecard] = await Promise.all([
    getConstraintDiagnosis(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
    getExperimentAnalysis(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
    getWorkspaceScorecard(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
  ]);

  const recommendations: Recommendation[] = [];

  // Rule 1: the workspace's primary constraint (Theory-of-Constraints
  // reasoning - see getConstraintDiagnosis) is always worth surfacing
  // once at least one force has been assessed.
  if (diagnosis.primaryConstraint !== null) {
    const constraint = diagnosis.primaryConstraint;
    const label = FORCE_LABELS[constraint.force];
    recommendations.push({
      source: "constraint_diagnosis",
      title: `Address your primary constraint: ${label}`,
      rationale:
        constraint.constraintNote && constraint.constraintNote.length > 0
          ? constraint.constraintNote
          : `${label} is your lowest-scoring assessed force (score ${constraint.score ?? "unknown"}).`,
      priority: "high",
      relatedId: constraint.force,
    });
  }

  // Rule 2: overdue tasks are a direct execution-drag signal already
  // computed by the scorecard.
  if (scorecard.tasks.overdueCount > 0) {
    recommendations.push({
      source: "overdue_tasks",
      title: `Clear ${scorecard.tasks.overdueCount} overdue task${scorecard.tasks.overdueCount === 1 ? "" : "s"}`,
      rationale: `${scorecard.tasks.overdueCount} task(s) are past their due date and not done yet.`,
      priority: scorecard.tasks.overdueCount >= 3 ? "high" : "medium",
      relatedId: null,
    });
  }

  // Rule 3: an assumption nobody has actually tested is real, unpriced
  // risk - experiment-analysis-use-cases.ts already distinguishes tested
  // from untested assumptions.
  if (experimentAnalysis.untestedAssumptionCount > 0) {
    const firstUntested = experimentAnalysis.assumptionCoverage.find(
      (a) => a.experimentCount === 0,
    );
    recommendations.push({
      source: "untested_assumptions",
      title:
        experimentAnalysis.untestedAssumptionCount === 1 && firstUntested
          ? `Run an experiment to test: ${firstUntested.statement}`
          : `Test ${experimentAnalysis.untestedAssumptionCount} untested assumptions`,
      rationale: `${experimentAnalysis.untestedAssumptionCount} of ${experimentAnalysis.totalAssumptions} assumption(s) in this workspace have never been tested by an experiment.`,
      priority: "medium",
      relatedId: firstUntested?.assumptionId ?? null,
    });
  }

  // Rule 4: the metric furthest from its target, among metrics with
  // enough data to compute progress at all - never guessed for a metric
  // missing a baseline/target/current value.
  const measurableMetrics = scorecard.metrics.metrics.filter(
    (m): m is typeof m & { progress: number } => m.progress !== null,
  );
  if (measurableMetrics.length > 0) {
    const laggingMetric = measurableMetrics.reduce((weakest, m) =>
      m.progress < weakest.progress ? m : weakest,
    );
    if (laggingMetric.progress < 0.5) {
      recommendations.push({
        source: "lagging_metric",
        title: `Focus on ${laggingMetric.name}`,
        rationale: `${laggingMetric.name} is only ${Math.round(laggingMetric.progress * 100)}% of the way from baseline to target - the furthest behind of your measurable metrics.`,
        priority: "medium",
        relatedId: laggingMetric.id,
      });
    }
  }

  recommendations.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);

  return { workspaceId: input.workspaceId, recommendations };
}
