import { z } from "zod";

/**
 * Phase 2 request/response contracts: assumptions (PRD-BIZCORE-007). Same
 * pattern as business-metrics.ts.
 *
 * `confidence` and `status` are separate axes: confidence is how sure the
 * business is about the stated value, status is whether it has actually
 * been checked against evidence yet (Phase 2's "Evidence" slice will later
 * link evidence records to an assumption and may drive status changes).
 */

export const assumptionConfidenceSchema = z.enum(["low", "medium", "high"]);
export type AssumptionConfidence = z.infer<typeof assumptionConfidenceSchema>;

export const assumptionStatusSchema = z.enum(["unvalidated", "validated", "invalidated"]);
export type AssumptionStatus = z.infer<typeof assumptionStatusSchema>;

/**
 * PRD-NUMBERS-006 (Phase 4 sixth slice: assumption provenance, spec
 * section 6.x): the controlled vocabulary for how a number came to
 * exist, distinct from the free-text `source` description. 'derived'
 * and 'scenario-override' are the two source types that can carry a
 * formula trace (formulaTraceKey/Version below).
 */
export const assumptionSourceTypeSchema = z.enum([
  "actual-imported",
  "actual-entered",
  "estimate-user",
  "estimate-ai",
  "benchmark",
  "derived",
  "scenario-override",
]);
export type AssumptionSourceType = z.infer<typeof assumptionSourceTypeSchema>;

export const createAssumptionRequestSchema = z.object({
  statement: z.string().trim().min(1).max(500),
  description: z.string().trim().max(2000).default(""),
  source: z.string().trim().max(200).default(""),
  confidence: assumptionConfidenceSchema.default("medium"),
  unit: z.string().trim().max(20).default(""),
  value: z.number().finite().optional(),
  sourceType: assumptionSourceTypeSchema.default("estimate-user"),
  sourceDate: z.string().datetime().optional(),
  ownerId: z.string().uuid().optional(),
  formulaTraceKey: z.string().trim().min(1).max(100).optional(),
  formulaTraceVersion: z.number().int().positive().optional(),
});
export type CreateAssumptionRequest = z.infer<typeof createAssumptionRequestSchema>;

export const updateAssumptionRequestSchema = z.object({
  statement: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(200).optional(),
  confidence: assumptionConfidenceSchema.optional(),
  status: assumptionStatusSchema.optional(),
  unit: z.string().trim().max(20).optional(),
  value: z.number().finite().nullable().optional(),
  sourceType: assumptionSourceTypeSchema.optional(),
  sourceDate: z.string().datetime().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  formulaTraceKey: z.string().trim().min(1).max(100).nullable().optional(),
  formulaTraceVersion: z.number().int().positive().nullable().optional(),
});
export type UpdateAssumptionRequest = z.infer<typeof updateAssumptionRequestSchema>;

export const assumptionSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  statement: z.string(),
  description: z.string(),
  source: z.string(),
  confidence: assumptionConfidenceSchema,
  status: assumptionStatusSchema,
  unit: z.string(),
  value: z.number().nullable(),
  sourceType: assumptionSourceTypeSchema,
  sourceDate: z.string().nullable(),
  ownerId: z.string().uuid().nullable(),
  formulaTraceKey: z.string().nullable(),
  formulaTraceVersion: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Assumption = z.infer<typeof assumptionSchema>;
