import { z } from "zod";

/**
 * Phase 2 request/response contracts: offers (PRD-BIZCORE-004). Same
 * pattern as business-core.ts and customer-profiles.ts.
 *
 * Price is always integer minor units (cents) over the wire too - never a
 * float dollar amount - so the client and server agree on representation
 * end to end (§40).
 */

export const offerStatusSchema = z.enum(["draft", "active", "archived"]);
export type OfferStatus = z.infer<typeof offerStatusSchema>;

export const createOfferRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  priceCents: z.number().int().nonnegative().optional(),
  currency: z.string().trim().toLowerCase().length(3).default("usd"),
});
export type CreateOfferRequest = z.infer<typeof createOfferRequestSchema>;

export const updateOfferRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  priceCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().trim().toLowerCase().length(3).optional(),
  status: offerStatusSchema.optional(),
});
export type UpdateOfferRequest = z.infer<typeof updateOfferRequestSchema>;

export const offerSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  priceCents: z.number().nullable(),
  currency: z.string(),
  status: offerStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Offer = z.infer<typeof offerSchema>;
