import { z } from "zod";

/**
 * Phase 2 request/response contracts: customer profiles (PRD-BIZCORE-003).
 * Same pattern as business-core.ts.
 */

export const createCustomerProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  painPoints: z.string().trim().max(2000).default(""),
  desiredOutcome: z.string().trim().max(2000).default(""),
});
export type CreateCustomerProfileRequest = z.infer<typeof createCustomerProfileRequestSchema>;

/** All fields optional - a partial update touches only what's provided. */
export const updateCustomerProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  painPoints: z.string().trim().max(2000).optional(),
  desiredOutcome: z.string().trim().max(2000).optional(),
});
export type UpdateCustomerProfileRequest = z.infer<typeof updateCustomerProfileRequestSchema>;

export const customerProfileSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  painPoints: z.string(),
  desiredOutcome: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomerProfile = z.infer<typeof customerProfileSchema>;
