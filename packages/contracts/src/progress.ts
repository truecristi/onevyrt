import { z } from "zod";

/**
 * Phase 3 request/response contracts: progress tracking and resume
 * behavior (PRD-CURRICULUM-003). Enrollments and progress belong to the
 * individual learner's own account - there is no workspaceId here,
 * unlike every Phase 2 contract.
 */

export const enrollmentStatusSchema = z.enum(["active", "completed", "withdrawn"]);
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

export const createEnrollmentRequestSchema = z.object({
  programVersionId: z.string().uuid(),
});
export type CreateEnrollmentRequest = z.infer<typeof createEnrollmentRequestSchema>;

export const enrollmentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  programVersionId: z.string().uuid(),
  status: enrollmentStatusSchema,
  enrolledAt: z.string(),
  completedAt: z.string().nullable(),
});
export type Enrollment = z.infer<typeof enrollmentSchema>;

export const lessonProgressStatusSchema = z.enum(["in_progress", "completed"]);
export type LessonProgressStatus = z.infer<typeof lessonProgressStatusSchema>;

// undefined = leave unchanged; a uuid = set the resume point; null = clear
// it (e.g. the lesson was restarted from the top).
export const updateLessonProgressRequestSchema = z.object({
  currentBlockId: z.string().uuid().nullable().optional(),
  status: lessonProgressStatusSchema.optional(),
});
export type UpdateLessonProgressRequest = z.infer<typeof updateLessonProgressRequestSchema>;

export const lessonProgressSchema = z.object({
  id: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  lessonId: z.string().uuid(),
  status: lessonProgressStatusSchema,
  currentBlockId: z.string().uuid().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type LessonProgress = z.infer<typeof lessonProgressSchema>;
