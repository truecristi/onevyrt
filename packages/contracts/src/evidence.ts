import { z } from "zod";

/**
 * Phase 2 request/response contracts: evidence (PRD-BIZCORE-009). Same
 * pattern as decisions.ts, plus optional links to an assumption and/or a
 * decision - undefined/omitted means "don't touch the link" on update,
 * null means "detach it", a uuid means "attach to this record" (validated
 * to belong to the same workspace in the domain layer, not here).
 */

export const evidenceStrengthSchema = z.enum(["weak", "moderate", "strong"]);
export type EvidenceStrength = z.infer<typeof evidenceStrengthSchema>;

export const createEvidenceRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  sourceUrl: z.string().trim().max(500).default(""),
  strength: evidenceStrengthSchema.default("moderate"),
  assumptionId: z.string().uuid().optional(),
  decisionId: z.string().uuid().optional(),
  collectedAt: z.string().datetime().optional(),
});
export type CreateEvidenceRequest = z.infer<typeof createEvidenceRequestSchema>;

export const updateEvidenceRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  sourceUrl: z.string().trim().max(500).optional(),
  strength: evidenceStrengthSchema.optional(),
  assumptionId: z.string().uuid().nullable().optional(),
  decisionId: z.string().uuid().nullable().optional(),
  collectedAt: z.string().datetime().nullable().optional(),
});
export type UpdateEvidenceRequest = z.infer<typeof updateEvidenceRequestSchema>;

export const evidenceSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  sourceUrl: z.string(),
  strength: evidenceStrengthSchema,
  assumptionId: z.string().uuid().nullable(),
  decisionId: z.string().uuid().nullable(),
  collectedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
