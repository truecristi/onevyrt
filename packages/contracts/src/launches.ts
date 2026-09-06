import { z } from "zod";

/**
 * Phase 5 request/response contracts: launches (PRD-BUILD-008, "Build and
 * execution" -> "Launch workflows", eighth and final slice). Same pattern
 * as offers.ts's offerComponents/bonuses/objections - checklist is a
 * whole-list-replacement jsonb array, edited client-side then saved, not
 * deep-merged.
 */

export const launchStatusSchema = z.enum([
  "planning",
  "scheduled",
  "live",
  "completed",
  "cancelled",
]);
export type LaunchStatus = z.infer<typeof launchStatusSchema>;

export const launchChecklistItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  done: z.boolean(),
});
export type LaunchChecklistItem = z.infer<typeof launchChecklistItemSchema>;

export const createLaunchRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  offerId: z.string().uuid().optional(),
  launchDate: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).default(""),
  checklist: z.array(launchChecklistItemSchema).default([]),
});
export type CreateLaunchRequest = z.infer<typeof createLaunchRequestSchema>;

export const updateLaunchRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  /** undefined = leave unchanged; null = detach; a uuid = attach (validated to belong to this workspace). */
  offerId: z.string().uuid().nullable().optional(),
  status: launchStatusSchema.optional(),
  launchDate: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
  /** Replaces the whole list, same as offers' array fields - not a per-item merge. */
  checklist: z.array(launchChecklistItemSchema).optional(),
});
export type UpdateLaunchRequest = z.infer<typeof updateLaunchRequestSchema>;

export const launchSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  offerId: z.string().uuid().nullable(),
  status: launchStatusSchema,
  launchDate: z.string().nullable(),
  notes: z.string(),
  checklist: z.array(launchChecklistItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Launch = z.infer<typeof launchSchema>;
