import { z } from "zod";

/**
 * Phase 4 request/response contracts: funnel mathematics (PRD-NUMBERS-003).
 * Workspace-scoped, one ordered funnel per workspace - see
 * schema.ts's funnelStages doc comment for the conversionRate semantics
 * ("share of the previous stage's volume that reaches this one").
 */

const conversionRateSchema = z.number().gt(0).lte(1);

export const createFunnelStageRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  orderIndex: z.number().int().min(0),
  conversionRate: conversionRateSchema.optional(),
});
export type CreateFunnelStageRequest = z.infer<typeof createFunnelStageRequestSchema>;

export const updateFunnelStageRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  orderIndex: z.number().int().min(0).optional(),
  /** undefined = leave unchanged; null = clear it (this stage becomes a "top of funnel" stage); a number = set it. */
  conversionRate: conversionRateSchema.nullable().optional(),
});
export type UpdateFunnelStageRequest = z.infer<typeof updateFunnelStageRequestSchema>;

export const funnelStageSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  orderIndex: z.number(),
  conversionRate: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FunnelStage = z.infer<typeof funnelStageSchema>;

export const calculateFunnelRequirementsRequestSchema = z.object({
  targetAtFinalStage: z.number().positive(),
});
export type CalculateFunnelRequirementsRequest = z.infer<
  typeof calculateFunnelRequirementsRequestSchema
>;

export const funnelStageRequirementSchema = z.object({
  stageId: z.string().uuid(),
  name: z.string(),
  orderIndex: z.number(),
  conversionRate: z.number().nullable(),
  requiredCount: z.number(),
});
export type FunnelStageRequirement = z.infer<typeof funnelStageRequirementSchema>;
