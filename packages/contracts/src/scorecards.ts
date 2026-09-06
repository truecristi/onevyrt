import { z } from "zod";
import { experimentDecisionSchema } from "./experiments";

/**
 * Phase 7 request/response contract: scorecards (PRD-REVIEW-001, README
 * "Review and intelligence" -> "Scorecards", first slice). A single
 * read-only aggregation over a workspace's existing goals, tasks,
 * experiments and business metrics - not a new source of truth, the
 * same reasoning as financial-dashboard.ts's contract.
 */

export const goalScorecardSummarySchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  achieved: z.number().int(),
  abandoned: z.number().int(),
  achievementRate: z.number(),
});
export type GoalScorecardSummary = z.infer<typeof goalScorecardSummarySchema>;

export const taskScorecardSummarySchema = z.object({
  total: z.number().int(),
  open: z.number().int(),
  inProgress: z.number().int(),
  done: z.number().int(),
  completionRate: z.number(),
  overdueCount: z.number().int(),
});
export type TaskScorecardSummary = z.infer<typeof taskScorecardSummarySchema>;

export const experimentScorecardSummarySchema = z.object({
  total: z.number().int(),
  planned: z.number().int(),
  running: z.number().int(),
  completed: z.number().int(),
  abandoned: z.number().int(),
  decisionCounts: z.record(experimentDecisionSchema, z.number().int()),
});
export type ExperimentScorecardSummary = z.infer<typeof experimentScorecardSummarySchema>;

export const businessMetricProgressSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  unit: z.string(),
  progress: z.number().nullable(),
});
export type BusinessMetricProgress = z.infer<typeof businessMetricProgressSchema>;

export const metricScorecardSummarySchema = z.object({
  total: z.number().int(),
  measurable: z.number().int(),
  metrics: z.array(businessMetricProgressSchema),
});
export type MetricScorecardSummary = z.infer<typeof metricScorecardSummarySchema>;

export const workspaceScorecardSchema = z.object({
  workspaceId: z.string().uuid(),
  goals: goalScorecardSummarySchema,
  tasks: taskScorecardSummarySchema,
  experiments: experimentScorecardSummarySchema,
  metrics: metricScorecardSummarySchema,
});
export type WorkspaceScorecard = z.infer<typeof workspaceScorecardSchema>;
