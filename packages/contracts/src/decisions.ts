import { z } from "zod";

/**
 * Phase 2 request/response contracts: decisions (PRD-BIZCORE-008). Same
 * pattern as assumptions.ts.
 */

export const decisionStatusSchema = z.enum(["proposed", "decided", "reversed"]);
export type DecisionStatus = z.infer<typeof decisionStatusSchema>;

export const createDecisionRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  context: z.string().trim().max(4000).default(""),
  outcome: z.string().trim().max(2000).default(""),
});
export type CreateDecisionRequest = z.infer<typeof createDecisionRequestSchema>;

export const updateDecisionRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  context: z.string().trim().max(4000).optional(),
  outcome: z.string().trim().max(2000).optional(),
  status: decisionStatusSchema.optional(),
});
export type UpdateDecisionRequest = z.infer<typeof updateDecisionRequestSchema>;

export const decisionSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  title: z.string(),
  context: z.string(),
  outcome: z.string(),
  status: decisionStatusSchema,
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Decision = z.infer<typeof decisionSchema>;
