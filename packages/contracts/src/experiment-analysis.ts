import { z } from "zod";
import { experimentStatusSchema, experimentDecisionSchema } from "./experiments";

/**
 * Phase 7 request/response contract: experiment analysis (PRD-REVIEW-003,
 * README "Review and intelligence" -> "Experiment analysis", third
 * slice). A read-only aggregation over a workspace's existing
 * experiments and assumptions - not a new source of truth, the same
 * reasoning as scorecards.ts's contract.
 */

export const experimentAnalysisEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: experimentStatusSchema,
  decision: experimentDecisionSchema.nullable(),
  assumptionId: z.string().uuid().nullable(),
  cycleTimeDays: z.number().nullable(),
});
export type ExperimentAnalysisEntry = z.infer<typeof experimentAnalysisEntrySchema>;

export const assumptionCoverageEntrySchema = z.object({
  assumptionId: z.string().uuid(),
  statement: z.string(),
  experimentCount: z.number().int(),
});
export type AssumptionCoverageEntry = z.infer<typeof assumptionCoverageEntrySchema>;

export const experimentAnalysisSchema = z.object({
  workspaceId: z.string().uuid(),
  totalExperiments: z.number().int(),
  timedExperimentCount: z.number().int(),
  averageCycleTimeDays: z.number().nullable(),
  decisionCounts: z.record(experimentDecisionSchema, z.number().int()),
  totalAssumptions: z.number().int(),
  testedAssumptionCount: z.number().int(),
  untestedAssumptionCount: z.number().int(),
  assumptionCoverage: z.array(assumptionCoverageEntrySchema),
  experiments: z.array(experimentAnalysisEntrySchema),
});
export type ExperimentAnalysis = z.infer<typeof experimentAnalysisSchema>;
