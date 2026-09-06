import { z } from "zod";
import { taskPrioritySchema } from "./tasks";

/**
 * Phase 6 request/response contracts: task proposals (PRD-AI-007, README
 * "AI coaching" -> "Task proposals", seventh slice; ADR-0012). Unlike
 * artifact-proposals.ts, accepting a task proposal creates a new task
 * rather than patching an existing record - proposedTask carries the new
 * task's fields, not a patch.
 */

export const taskProposalStatusSchema = z.enum(["pending", "accepted", "rejected"]);
export type TaskProposalStatus = z.infer<typeof taskProposalStatusSchema>;

/** A natural-language instruction grounding what task to suggest (e.g. "suggest a next action based on my last decision"). */
export const createTaskProposalRequestSchema = z.object({
  instruction: z.string().trim().min(1).max(1000),
});
export type CreateTaskProposalRequest = z.infer<typeof createTaskProposalRequestSchema>;

/** The proposed task's own fields - the same shape createTaskRequestSchema accepts, minus link fields (projectId/blockedByTaskId) an AI proposal shouldn't be guessing at. */
export const proposedTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  priority: taskPrioritySchema.default("medium"),
});
export type ProposedTask = z.infer<typeof proposedTaskSchema>;

export const taskProposalSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  proposedTask: proposedTaskSchema,
  rationale: z.string(),
  promptTemplateKey: z.string(),
  promptTemplateVersion: z.number().int(),
  providerId: z.string(),
  model: z.string(),
  status: taskProposalStatusSchema,
  reviewedByUserId: z.string().uuid().nullable(),
  reviewedAt: z.string().nullable(),
  createdTaskId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskProposal = z.infer<typeof taskProposalSchema>;
