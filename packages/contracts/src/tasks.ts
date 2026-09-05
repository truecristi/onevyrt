import { z } from "zod";

/**
 * Phase 2 request/response contracts: tasks (PRD-BIZCORE-005), extended
 * by PRD-BUILD-005 (Phase 5 fifth slice: task and project system). Same
 * pattern as the other business-core contracts.
 */

export const taskStatusSchema = z.enum(["open", "in_progress", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const createTaskRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  dueDate: z.string().datetime().optional(),
  projectId: z.string().uuid().optional(),
  priority: taskPrioritySchema.default("medium"),
  blockedByTaskId: z.string().uuid().optional(),
});
export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

/** Only status is mutable through this route - editing title/description isn't part of this slice. */
export const updateTaskStatusRequestSchema = z.object({
  status: taskStatusSchema,
});
export type UpdateTaskStatusRequest = z.infer<typeof updateTaskStatusRequestSchema>;

/** The project/priority/blocker fields this slice adds - a separate route from status, since status has its own dedicated completedAt side effect. */
export const updateTaskRequestSchema = z.object({
  /** undefined = leave unchanged; null = remove from its project; a uuid = set it (validated to belong to this workspace). */
  projectId: z.string().uuid().nullable().optional(),
  priority: taskPrioritySchema.optional(),
  /** undefined = leave unchanged; null = clear the blocker; a uuid = set it (validated to belong to this workspace, and not be the task itself). */
  blockedByTaskId: z.string().uuid().nullable().optional(),
});
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;

export const taskSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: taskStatusSchema,
  dueDate: z.string().nullable(),
  completedAt: z.string().nullable(),
  projectId: z.string().uuid().nullable(),
  priority: taskPrioritySchema,
  blockedByTaskId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof taskSchema>;
