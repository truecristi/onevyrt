import { z } from "zod";

/**
 * Phase 5 request/response contracts: experiments (PRD-BUILD-006, "Build
 * and execution" -> "Experiment system", sixth slice). Same pattern as
 * assumptions.ts - see schema.ts's experiments table doc comment for why
 * this deliberately omits metric/baseline/target/audience/budget/
 * confidence from spec section 6.19's full field list.
 */

export const experimentStatusSchema = z.enum(["planned", "running", "completed", "abandoned"]);
export type ExperimentStatus = z.infer<typeof experimentStatusSchema>;

/** The follow-up call once an experiment has a result - spec section 6.19's own vocabulary. */
export const experimentDecisionSchema = z.enum([
  "adopt",
  "iterate",
  "retest",
  "stop",
  "insufficient_evidence",
  "reject",
]);
export type ExperimentDecision = z.infer<typeof experimentDecisionSchema>;

export const createExperimentRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  hypothesis: z.string().trim().max(2000).default(""),
  method: z.string().trim().max(2000).default(""),
  assumptionId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
});
export type CreateExperimentRequest = z.infer<typeof createExperimentRequestSchema>;

export const updateExperimentRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  hypothesis: z.string().trim().max(2000).optional(),
  method: z.string().trim().max(2000).optional(),
  status: experimentStatusSchema.optional(),
  /** undefined = leave unchanged; null = detach; a uuid = attach (validated to belong to this workspace). */
  assumptionId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  result: z.string().trim().max(2000).optional(),
  decision: experimentDecisionSchema.nullable().optional(),
});
export type UpdateExperimentRequest = z.infer<typeof updateExperimentRequestSchema>;

export const experimentSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  hypothesis: z.string(),
  method: z.string(),
  status: experimentStatusSchema,
  assumptionId: z.string().uuid().nullable(),
  ownerId: z.string().uuid().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  result: z.string(),
  decision: experimentDecisionSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Experiment = z.infer<typeof experimentSchema>;
