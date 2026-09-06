import { z } from "zod";

/**
 * Phase 7 request/response contract: recommendation ranking
 * (PRD-REVIEW-006, README "Review and intelligence" -> "Recommendation
 * ranking", sixth slice). A deterministic, rule-based ranking over the
 * workspace's constraint diagnosis, experiment analysis and scorecard -
 * see recommendation-use-cases.ts's doc comment for why this is
 * deliberately not AI-generated (that's Phase 6's task proposals).
 */

export const recommendationSourceSchema = z.enum([
  "constraint_diagnosis",
  "overdue_tasks",
  "untested_assumptions",
  "lagging_metric",
]);
export type RecommendationSource = z.infer<typeof recommendationSourceSchema>;

export const recommendationPrioritySchema = z.enum(["high", "medium", "low"]);
export type RecommendationPriority = z.infer<typeof recommendationPrioritySchema>;

export const recommendationSchema = z.object({
  source: recommendationSourceSchema,
  title: z.string(),
  rationale: z.string(),
  priority: recommendationPrioritySchema,
  relatedId: z.string().nullable(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const recommendationsSchema = z.object({
  workspaceId: z.string().uuid(),
  recommendations: z.array(recommendationSchema),
});
export type Recommendations = z.infer<typeof recommendationsSchema>;
