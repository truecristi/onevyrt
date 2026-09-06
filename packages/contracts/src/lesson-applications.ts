import { z } from "zod";

/**
 * Phase 3 request/response contracts: lesson application
 * (PRD-CURRICULUM-007). Links a learner's build/practice/implementation
 * block to the real Phase 2 business record it produced - the concrete
 * tie between curriculum and business data.
 *
 * resourceType is restricted to the workspace-scoped Phase 2 entities
 * that a lesson activity plausibly produces or updates - not every
 * Phase 2 table (business_profiles is a workspace singleton, not
 * something a single lesson "creates"; audit_log/evidence are meta
 * records, not activity outputs).
 */

export const applicationResourceTypeSchema = z.enum([
  "goal",
  "task",
  "offer",
  "customer_profile",
  "business_metric",
  "assumption",
  "decision",
]);
export type ApplicationResourceType = z.infer<typeof applicationResourceTypeSchema>;

export const submitLessonApplicationRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  resourceType: applicationResourceTypeSchema,
  resourceId: z.string().uuid(),
  note: z.string().trim().max(2000).default(""),
});
export type SubmitLessonApplicationRequest = z.infer<typeof submitLessonApplicationRequestSchema>;

export const lessonApplicationSchema = z.object({
  id: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  lessonBlockId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  resourceType: applicationResourceTypeSchema,
  resourceId: z.string().uuid(),
  note: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LessonApplication = z.infer<typeof lessonApplicationSchema>;
