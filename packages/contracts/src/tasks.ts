import { z } from "zod";

/**
 * Phase 2 request/response contracts: tasks (PRD-BIZCORE-005). Same
 * pattern as the other business-core contracts.
 */

export const taskStatusSchema = z.enum(["open", "in_progress", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const createTaskRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  dueDate: z.string().datetime().optional(),
});
export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

/** Only status is mutable after creation - editing title/description isn't part of this slice. */
export const updateTaskStatusRequestSchema = z.object({
  status: taskStatusSchema,
});
export type UpdateTaskStatusRequest = z.infer<typeof updateTaskStatusRequestSchema>;

export const taskSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: taskStatusSchema,
  dueDate: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof taskSchema>;
