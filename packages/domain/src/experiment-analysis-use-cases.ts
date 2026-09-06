import type { Database } from "@onevyrt/database";
import type { ExperimentDecision } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { listExperiments, type ExperimentRecord } from "./experiment-use-cases";
import { listAssumptions, type AssumptionRecord } from "./assumption-use-cases";

/**
 * PRD-REVIEW-003 vertical slice: experiment analysis (README "Review and
 * intelligence" -> "Experiment analysis", third slice of Phase 7). Not a
 * new source of truth - a read-only aggregation over a workspace's
 * existing experiments and assumptions, the same "aggregation" reasoning
 * as scorecard-use-cases.ts's getWorkspaceScorecard, but going deeper on
 * one dimension scorecards deliberately keep shallow: how fast
 * experiments actually reach a decision (cycle time), and how much of
 * the workspace's assumption base has been put to a real test.
 */

export interface ExperimentAnalysisEntry {
  id: string;
  name: string;
  status: ExperimentRecord["status"];
  decision: ExperimentDecision | null;
  assumptionId: string | null;
  /** Whole days from startedAt to endedAt; null when either is missing - never estimated from a partial pair. */
  cycleTimeDays: number | null;
}

export interface AssumptionCoverageEntry {
  assumptionId: string;
  statement: string;
  /** How many experiments in this workspace are linked to this assumption - 0 means it has never actually been tested. */
  experimentCount: number;
}

export interface ExperimentAnalysisRecord {
  workspaceId: string;
  totalExperiments: number;
  /** Experiments with both startedAt and endedAt set - the only ones a cycle time can be computed for. */
  timedExperimentCount: number;
  /** Mean cycle time across timedExperimentCount experiments; null when there are none yet. */
  averageCycleTimeDays: number | null;
  /** Every ExperimentDecision key is present, defaulting to 0 - same shape as scorecard-use-cases.ts's decisionCounts. */
  decisionCounts: Record<ExperimentDecision, number>;
  totalAssumptions: number;
  testedAssumptionCount: number;
  untestedAssumptionCount: number;
  /** One entry per assumption in the workspace, tested or not, sorted by experimentCount descending then statement - lets a caller find the untested ones (experimentCount === 0) without a second request. */
  assumptionCoverage: AssumptionCoverageEntry[];
  experiments: ExperimentAnalysisEntry[];
}

export interface GetExperimentAnalysisInput {
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function cycleTimeDays(experiment: ExperimentRecord): number | null {
  if (experiment.startedAt === null || experiment.endedAt === null) {
    return null;
  }
  return Math.round((experiment.endedAt.getTime() - experiment.startedAt.getTime()) / MS_PER_DAY);
}

function summarizeDecisions(experiments: ExperimentRecord[]): Record<ExperimentDecision, number> {
  const counts = Object.fromEntries(
    EXPERIMENT_DECISIONS.map((decision) => [decision, 0]),
  ) as Record<ExperimentDecision, number>;
  for (const experiment of experiments) {
    if (experiment.decision !== null) {
      counts[experiment.decision] += 1;
    }
  }
  return counts;
}

function summarizeAssumptionCoverage(
  assumptions: AssumptionRecord[],
  experiments: ExperimentRecord[],
): AssumptionCoverageEntry[] {
  const countByAssumptionId = new Map<string, number>();
  for (const experiment of experiments) {
    if (experiment.assumptionId !== null) {
      countByAssumptionId.set(
        experiment.assumptionId,
        (countByAssumptionId.get(experiment.assumptionId) ?? 0) + 1,
      );
    }
  }

  return assumptions
    .map((assumption) => ({
      assumptionId: assumption.id,
      statement: assumption.statement,
      experimentCount: countByAssumptionId.get(assumption.id) ?? 0,
    }))
    .sort(
      (a, b) => b.experimentCount - a.experimentCount || a.statement.localeCompare(b.statement),
    );
}

export async function getExperimentAnalysis(
  db: Database,
  input: GetExperimentAnalysisInput,
): Promise<ExperimentAnalysisRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const [experiments, assumptions] = await Promise.all([
    listExperiments(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
    listAssumptions(db, { workspaceId: input.workspaceId, actorUserId: input.actorUserId }),
  ]);

  const entries: ExperimentAnalysisEntry[] = experiments.map((experiment) => ({
    id: experiment.id,
    name: experiment.name,
    status: experiment.status,
    decision: experiment.decision,
    assumptionId: experiment.assumptionId,
    cycleTimeDays: cycleTimeDays(experiment),
  }));

  const timedEntries = entries.filter((e) => e.cycleTimeDays !== null);
  const averageCycleTimeDays =
    timedEntries.length === 0
      ? null
      : timedEntries.reduce((sum, e) => sum + (e.cycleTimeDays ?? 0), 0) / timedEntries.length;

  const assumptionCoverage = summarizeAssumptionCoverage(assumptions, experiments);
  const testedAssumptionCount = assumptionCoverage.filter((a) => a.experimentCount > 0).length;

  return {
    workspaceId: input.workspaceId,
    totalExperiments: experiments.length,
    timedExperimentCount: timedEntries.length,
    averageCycleTimeDays,
    decisionCounts: summarizeDecisions(experiments),
    totalAssumptions: assumptions.length,
    testedAssumptionCount,
    untestedAssumptionCount: assumptions.length - testedAssumptionCount,
    assumptionCoverage,
    experiments: entries,
  };
}
