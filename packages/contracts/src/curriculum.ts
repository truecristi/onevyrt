import { z } from "zod";

/**
 * Phase 3 request/response contracts: programs, program versions and
 * lessons (PRD-CURRICULUM-001). Unlike Phase 2's contracts, writes here
 * are platform-admin-only (see @onevyrt/domain's requirePlatformAdmin) -
 * every workspace member can read published content, but only a platform
 * admin can create or edit it.
 */

export const contentStatusSchema = z.enum(["draft", "published", "archived"]);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase, alphanumeric, hyphen-separated");

export const createProgramRequestSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2000).default(""),
  orderIndex: z.number().int().default(0),
});
export type CreateProgramRequest = z.infer<typeof createProgramRequestSchema>;

export const updateProgramRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(2000).optional(),
  orderIndex: z.number().int().optional(),
  status: contentStatusSchema.optional(),
});
export type UpdateProgramRequest = z.infer<typeof updateProgramRequestSchema>;

export const programSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  orderIndex: z.number(),
  status: contentStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Program = z.infer<typeof programSchema>;

export const createProgramVersionRequestSchema = z.object({
  version: z.number().int().positive(),
  outcomes: z.string().trim().max(2000).default(""),
});
export type CreateProgramVersionRequest = z.infer<typeof createProgramVersionRequestSchema>;

export const programVersionSchema = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  version: z.number(),
  status: contentStatusSchema,
  outcomes: z.string(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProgramVersion = z.infer<typeof programVersionSchema>;

export const createLessonRequestSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(200),
  outcome: z.string().trim().max(500).default(""),
  orderIndex: z.number().int().default(0),
  estimatedMinutes: z.number().int().positive().optional(),
});
export type CreateLessonRequest = z.infer<typeof createLessonRequestSchema>;

export const updateLessonRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  outcome: z.string().trim().max(500).optional(),
  orderIndex: z.number().int().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  status: contentStatusSchema.optional(),
});
export type UpdateLessonRequest = z.infer<typeof updateLessonRequestSchema>;

export const lessonSchema = z.object({
  id: z.string().uuid(),
  programVersionId: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  outcome: z.string(),
  orderIndex: z.number(),
  estimatedMinutes: z.number().nullable(),
  status: contentStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Lesson = z.infer<typeof lessonSchema>;
