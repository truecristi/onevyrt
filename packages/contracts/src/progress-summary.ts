import { z } from "zod";

/**
 * Phase 7 request/response contract: progress summaries (PRD-REVIEW-005,
 * README "Review and intelligence" -> "Progress summaries", fifth
 * slice). Read-only comparison of the workspace's current scorecard
 * against the closest available weekly-review snapshot at or before a
 * requested number of weeks back - see progress-summary-use-cases.ts's
 * doc comment for why weekly reviews are the only historical baseline
 * this schema has.
 */

export const deltaEntrySchema = z.object({
  current: z.number(),
  previous: z.number().nullable(),
  delta: z.number().nullable(),
});
export type DeltaEntry = z.infer<typeof deltaEntrySchema>;

export const metricProgressChangeSchema = z.object({
  metricId: z.string().uuid(),
  name: z.string(),
  currentProgress: z.number().nullable(),
  previousProgress: z.number().nullable(),
  delta: z.number().nullable(),
});
export type MetricProgressChange = z.infer<typeof metricProgressChangeSchema>;

export const progressSummarySchema = z.object({
  workspaceId: z.string().uuid(),
  hasComparison: z.boolean(),
  comparisonWeekStartDate: z.string().nullable(),
  goalsAchievementRate: deltaEntrySchema,
  tasksCompletionRate: deltaEntrySchema,
  experimentsCompleted: deltaEntrySchema,
  metrics: z.array(metricProgressChangeSchema),
});
export type ProgressSummary = z.infer<typeof progressSummarySchema>;

/** GET .../progress-summary optionally takes ?weeksBack=N (default 4 - see getProgressSummary). */
export const getProgressSummaryQuerySchema = z.object({
  weeksBack: z.coerce.number().int().min(1).max(52).optional(),
});
export type GetProgressSummaryQuery = z.infer<typeof getProgressSummaryQuerySchema>;
