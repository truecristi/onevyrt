import { z } from "zod";
import { workspaceScorecardSchema } from "./scorecards";

/**
 * Phase 7 request/response contract: weekly reviews (PRD-REVIEW-002,
 * README "Review and intelligence" -> "Weekly reviews", second slice).
 * One review per workspace per calendar week - upsertWeeklyReviewRequestSchema
 * is used by both "create this week's review" and "revise it" (same
 * request shape either way, matching upsertBusinessProfile's contract).
 */

/** GET .../weekly-reviews with no query returns the full list; with ?weekOf=... returns just that week's review (or null). */
export const getWeeklyReviewQuerySchema = z.object({
  weekOf: z.string().datetime().optional(),
});
export type GetWeeklyReviewQuery = z.infer<typeof getWeeklyReviewQuerySchema>;

export const upsertWeeklyReviewRequestSchema = z.object({
  /** Any date within the target week - the domain layer normalizes it to that week's Monday. */
  weekOf: z.string().datetime(),
  wins: z.string().trim().max(4000).default(""),
  challenges: z.string().trim().max(4000).default(""),
  focusNextWeek: z.string().trim().max(4000).default(""),
});
export type UpsertWeeklyReviewRequest = z.infer<typeof upsertWeeklyReviewRequestSchema>;

export const weeklyReviewSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  authorUserId: z.string().uuid(),
  weekStartDate: z.string(),
  wins: z.string(),
  challenges: z.string(),
  focusNextWeek: z.string(),
  scorecardSnapshot: workspaceScorecardSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WeeklyReview = z.infer<typeof weeklyReviewSchema>;
