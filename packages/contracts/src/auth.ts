import { z } from "zod";

/**
 * Request/response contracts for the Phase 1 auth + workspace vertical
 * slice (PRD-AUTH-001..004, PRD-TENANCY-001). Shared between the API route
 * handlers in apps/web and any future client so both sides validate the
 * same shape.
 */

export const registerRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12, "Password must be at least 12 characters"),
  workspaceName: z.string().trim().min(1).max(200),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const createWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
});
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;

export const sessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const workspaceSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.enum(["owner", "member"]),
});
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
