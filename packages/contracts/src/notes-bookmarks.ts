import { z } from "zod";

/**
 * Phase 3 request/response contracts: notes and bookmarks
 * (PRD-CURRICULUM-004). Personal, not workspace-scoped - same shape as
 * progress.ts.
 */

export const createBookmarkRequestSchema = z.object({
  lessonId: z.string().uuid(),
});
export type CreateBookmarkRequest = z.infer<typeof createBookmarkRequestSchema>;

export const bookmarkSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  lessonId: z.string().uuid(),
  createdAt: z.string(),
});
export type Bookmark = z.infer<typeof bookmarkSchema>;

export const createNoteRequestSchema = z.object({
  lessonId: z.string().uuid(),
  content: z.string().trim().min(1).max(5000),
});
export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>;

export const updateNoteRequestSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});
export type UpdateNoteRequest = z.infer<typeof updateNoteRequestSchema>;

export const noteSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  lessonId: z.string().uuid(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Note = z.infer<typeof noteSchema>;
