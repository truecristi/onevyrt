import { z } from "zod";

/**
 * Phase 3 request/response contracts: prerequisites (PRD-CURRICULUM-006).
 * Platform-admin authoring, same as programs/versions/lessons/blocks -
 * both lessons must be in the same program version
 * (prerequisite-use-cases.ts).
 */

export const addPrerequisiteRequestSchema = z.object({
  prerequisiteLessonId: z.string().uuid(),
});
export type AddPrerequisiteRequest = z.infer<typeof addPrerequisiteRequestSchema>;

export const lessonPrerequisiteSchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid(),
  prerequisiteLessonId: z.string().uuid(),
  createdAt: z.string(),
});
export type LessonPrerequisite = z.infer<typeof lessonPrerequisiteSchema>;
