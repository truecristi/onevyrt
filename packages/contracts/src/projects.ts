import { z } from "zod";

/**
 * Phase 5 request/response contracts: projects (PRD-BUILD-005, part of
 * "task and project system"). Same pattern as business-core.ts.
 */

export const projectStatusSchema = z.enum(["active", "completed", "archived"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const createProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
});
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const updateProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  status: projectStatusSchema.optional(),
});
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

export const projectSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  status: projectStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;
