import { z } from "zod";
import { assumptionConfidenceSchema } from "./assumptions";

/**
 * Phase 7 request/response contracts: force assessments and constraint
 * diagnosis (PRD-REVIEW-004, README "Review and intelligence" ->
 * "Constraint diagnosis", fourth slice; spec section 6.4's "Diagnostic
 * and Seven Forces"). Reuses assumptionConfidenceSchema for `confidence`
 * rather than a near-identical parallel enum - same low/medium/high
 * vocabulary means the same thing in both places.
 */

export const forceSchema = z.enum([
  "owner_psychology",
  "vision_planning",
  "sales_marketing",
  "people_culture",
  "operations_systems",
  "finance_measurement",
  "customer_experience",
]);
export type Force = z.infer<typeof forceSchema>;

export const upsertForceAssessmentRequestSchema = z.object({
  force: forceSchema,
  score: z.number().int().min(0).max(100),
  target: z.number().int().min(0).max(100).optional(),
  confidence: assumptionConfidenceSchema.default("medium"),
  evidence: z.string().trim().max(4000).default(""),
  constraintNote: z.string().trim().max(2000).default(""),
  recommendations: z.string().trim().max(4000).default(""),
  reassessedAt: z.string().datetime().optional(),
});
export type UpsertForceAssessmentRequest = z.infer<typeof upsertForceAssessmentRequestSchema>;

export const forceAssessmentSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  force: forceSchema,
  score: z.number().int(),
  target: z.number().int().nullable(),
  confidence: assumptionConfidenceSchema,
  evidence: z.string(),
  constraintNote: z.string(),
  recommendations: z.string(),
  reassessedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ForceAssessment = z.infer<typeof forceAssessmentSchema>;

export const constraintDiagnosisEntrySchema = z.object({
  force: forceSchema,
  assessed: z.boolean(),
  score: z.number().int().nullable(),
  target: z.number().int().nullable(),
  gapToTarget: z.number().int().nullable(),
  confidence: assumptionConfidenceSchema.nullable(),
  constraintNote: z.string().nullable(),
});
export type ConstraintDiagnosisEntry = z.infer<typeof constraintDiagnosisEntrySchema>;

export const constraintDiagnosisSchema = z.object({
  workspaceId: z.string().uuid(),
  forces: z.array(constraintDiagnosisEntrySchema),
  rankedAssessedForces: z.array(constraintDiagnosisEntrySchema),
  primaryConstraint: constraintDiagnosisEntrySchema.nullable(),
  unassessedForceCount: z.number().int(),
});
export type ConstraintDiagnosis = z.infer<typeof constraintDiagnosisSchema>;
