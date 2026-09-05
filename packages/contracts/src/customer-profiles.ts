import { z } from "zod";

/**
 * Phase 2 request/response contracts: customer profiles (PRD-BIZCORE-003),
 * extended by PRD-BUILD-002 (Phase 5 second slice: customer and
 * positioning tools). Same pattern as business-core.ts.
 */

export const createCustomerProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  painPoints: z.string().trim().max(2000).default(""),
  desiredOutcome: z.string().trim().max(2000).default(""),
  emotionalConsequence: z.string().trim().max(2000).default(""),
  uniqueMechanism: z.string().trim().max(2000).default(""),
  proof: z.string().trim().max(2000).default(""),
  callToAction: z.string().trim().max(500).default(""),
  positioningStatement: z.string().trim().max(2000).default(""),
});
export type CreateCustomerProfileRequest = z.infer<typeof createCustomerProfileRequestSchema>;

/** All fields optional - a partial update touches only what's provided. */
export const updateCustomerProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  painPoints: z.string().trim().max(2000).optional(),
  desiredOutcome: z.string().trim().max(2000).optional(),
  emotionalConsequence: z.string().trim().max(2000).optional(),
  uniqueMechanism: z.string().trim().max(2000).optional(),
  proof: z.string().trim().max(2000).optional(),
  callToAction: z.string().trim().max(500).optional(),
  positioningStatement: z.string().trim().max(2000).optional(),
});
export type UpdateCustomerProfileRequest = z.infer<typeof updateCustomerProfileRequestSchema>;

export const customerProfileSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  painPoints: z.string(),
  desiredOutcome: z.string(),
  emotionalConsequence: z.string(),
  uniqueMechanism: z.string(),
  proof: z.string(),
  callToAction: z.string(),
  positioningStatement: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomerProfile = z.infer<typeof customerProfileSchema>;
