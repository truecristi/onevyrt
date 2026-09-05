import { z } from "zod";

/**
 * Phase 5 request/response contracts: the funnel builder (PRD-BUILD-003).
 * Workspace-scoped, one ordered funnel map per workspace - see
 * schema.ts's funnelSteps doc comment for how this differs from
 * funnel-stages.ts's conversion-rate math.
 */

export const funnelStepTypeSchema = z.enum([
  "landing-page",
  "opt-in",
  "webinar",
  "appointment",
  "sales-call",
  "sales-page",
  "checkout",
  "confirmation",
  "custom",
]);
export type FunnelStepType = z.infer<typeof funnelStepTypeSchema>;

export const createFunnelStepRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  stepType: funnelStepTypeSchema,
  orderIndex: z.number().int().min(0),
  offerId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).default(""),
});
export type CreateFunnelStepRequest = z.infer<typeof createFunnelStepRequestSchema>;

export const updateFunnelStepRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  stepType: funnelStepTypeSchema.optional(),
  orderIndex: z.number().int().min(0).optional(),
  /** undefined = leave unchanged; null = unlink the offer; a uuid = set it (validated to belong to this workspace). */
  offerId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type UpdateFunnelStepRequest = z.infer<typeof updateFunnelStepRequestSchema>;

export const funnelStepSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  stepType: funnelStepTypeSchema,
  orderIndex: z.number(),
  offerId: z.string().uuid().nullable(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FunnelStep = z.infer<typeof funnelStepSchema>;
