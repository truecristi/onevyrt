import { z } from "zod";
import { recommendationSourceSchema } from "./recommendations";

/**
 * Phase 7 request/response contracts: improvement loops
 * (PRD-REVIEW-007, README "Review and intelligence" -> "Improvement
 * loops", seventh and final slice). Reuses recommendationSourceSchema
 * rather than a parallel enum - an improvement loop always starts from
 * one of getRecommendations' sources.
 */

export const startImprovementLoopRequestSchema = z.object({
  source: recommendationSourceSchema,
  relatedId: z.string().max(200).nullable(),
  title: z.string().trim().min(1).max(200),
  rationale: z.string().trim().max(2000).default(""),
  taskId: z.string().uuid().optional(),
});
export type StartImprovementLoopRequest = z.infer<typeof startImprovementLoopRequestSchema>;

export const closeImprovementLoopRequestSchema = z.object({
  outcomeNote: z.string().trim().max(4000).default(""),
});
export type CloseImprovementLoopRequest = z.infer<typeof closeImprovementLoopRequestSchema>;

export const improvementLoopStatusSchema = z.enum(["open", "closed"]);
export type ImprovementLoopStatus = z.infer<typeof improvementLoopStatusSchema>;

export const improvementLoopSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  actorUserId: z.string().uuid(),
  source: recommendationSourceSchema,
  relatedId: z.string().nullable(),
  title: z.string(),
  rationale: z.string(),
  taskId: z.string().uuid().nullable(),
  status: improvementLoopStatusSchema,
  baselineValue: z.number().nullable(),
  closeValue: z.number().nullable(),
  improved: z.boolean().nullable(),
  outcomeNote: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
});
export type ImprovementLoop = z.infer<typeof improvementLoopSchema>;
