import { z } from "zod";

/**
 * Phase 2 request/response contracts: canonical business record + goals
 * (PRD-BIZCORE-001, PRD-BIZCORE-002). Same pattern as auth.ts - shared
 * between apps/web's route handlers and packages/domain's use cases so
 * both validate the identical shape.
 */

export const businessStageSchema = z.enum(["idea", "launched", "growing", "established"]);
export type BusinessStage = z.infer<typeof businessStageSchema>;

export const upsertBusinessProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  vision: z.string().trim().max(2000).default(""),
  mission: z.string().trim().max(2000).default(""),
  industry: z.string().trim().max(200).default(""),
  stage: businessStageSchema.default("idea"),
});
export type UpsertBusinessProfileRequest = z.infer<typeof upsertBusinessProfileRequestSchema>;

export const businessProfileSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  vision: z.string(),
  mission: z.string(),
  industry: z.string(),
  stage: businessStageSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export const goalStatusSchema = z.enum(["active", "achieved", "abandoned"]);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const createGoalRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  targetDate: z.string().datetime().optional(),
});
export type CreateGoalRequest = z.infer<typeof createGoalRequestSchema>;

export const updateGoalRequestSchema = z.object({
  status: goalStatusSchema,
});
export type UpdateGoalRequest = z.infer<typeof updateGoalRequestSchema>;

export const goalSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  targetDate: z.string().nullable(),
  status: goalStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Goal = z.infer<typeof goalSchema>;
