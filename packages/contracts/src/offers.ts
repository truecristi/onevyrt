import { z } from "zod";

/**
 * Phase 2 request/response contracts: offers (PRD-BIZCORE-004), extended
 * by PRD-BUILD-001 (Phase 5 first slice: offer builder). Same pattern as
 * business-core.ts and customer-profiles.ts.
 *
 * Price is always integer minor units (cents) over the wire too - never a
 * float dollar amount - so the client and server agree on representation
 * end to end (§40).
 */

export const offerStatusSchema = z.enum(["draft", "active", "archived"]);
export type OfferStatus = z.infer<typeof offerStatusSchema>;

const offerComponentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
});
export type OfferComponent = z.infer<typeof offerComponentSchema>;

const offerBonusSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  /** Free text (e.g. "$500 value") - not a parsed money amount, since a bonus's stated value is a marketing claim, not a ledger entry. */
  value: z.string().trim().max(100).default(""),
});
export type OfferBonus = z.infer<typeof offerBonusSchema>;

const offerObjectionSchema = z.object({
  objection: z.string().trim().min(1).max(500),
  response: z.string().trim().max(2000).default(""),
});
export type OfferObjection = z.infer<typeof offerObjectionSchema>;

export const createOfferRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  priceCents: z.number().int().nonnegative().optional(),
  currency: z.string().trim().toLowerCase().length(3).default("usd"),
  problemStatement: z.string().trim().max(2000).default(""),
  desiredOutcome: z.string().trim().max(2000).default(""),
  positioningStatement: z.string().trim().max(2000).default(""),
  valueProposition: z.string().trim().max(2000).default(""),
  guarantee: z.string().trim().max(2000).default(""),
  riskReversal: z.string().trim().max(2000).default(""),
  offerComponents: z.array(offerComponentSchema).max(50).default([]),
  bonuses: z.array(offerBonusSchema).max(50).default([]),
  objections: z.array(offerObjectionSchema).max(50).default([]),
});
export type CreateOfferRequest = z.infer<typeof createOfferRequestSchema>;

export const updateOfferRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  priceCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().trim().toLowerCase().length(3).optional(),
  status: offerStatusSchema.optional(),
  problemStatement: z.string().trim().max(2000).optional(),
  desiredOutcome: z.string().trim().max(2000).optional(),
  positioningStatement: z.string().trim().max(2000).optional(),
  valueProposition: z.string().trim().max(2000).optional(),
  guarantee: z.string().trim().max(2000).optional(),
  riskReversal: z.string().trim().max(2000).optional(),
  offerComponents: z.array(offerComponentSchema).max(50).optional(),
  bonuses: z.array(offerBonusSchema).max(50).optional(),
  objections: z.array(offerObjectionSchema).max(50).optional(),
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
  problemStatement: z.string(),
  desiredOutcome: z.string(),
  positioningStatement: z.string(),
  valueProposition: z.string(),
  guarantee: z.string(),
  riskReversal: z.string(),
  offerComponents: z.array(offerComponentSchema),
  bonuses: z.array(offerBonusSchema),
  objections: z.array(offerObjectionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Offer = z.infer<typeof offerSchema>;
