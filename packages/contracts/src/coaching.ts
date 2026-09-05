import { z } from "zod";

/**
 * Phase 6 request/response contracts: the coaching interface (PRD-AI-004,
 * README "AI coaching" -> "Coaching interface", fourth slice; spec §7.1's
 * "ask diagnostic follow-up questions"). A single conversational
 * question-in, answer-out shape - lesson explanations, artifact/task
 * proposals and sketch specifications are separate, more structured later
 * slices, not folded into this one endpoint.
 */

export const askCoachingRequestSchema = z.object({
  question: z.string().trim().min(1).max(2000),
});
export type AskCoachingRequest = z.infer<typeof askCoachingRequestSchema>;

export const coachingContextManifestEntrySchema = z.object({
  recordType: z.string(),
  recordId: z.string().uuid(),
  version: z.string(),
  classification: z.string(),
  redactedFields: z.array(z.string()),
});

export const coachingResponseSchema = z.object({
  answer: z.string(),
  /** Set when the assistant has a natural next question worth asking - null when the answer stands alone. */
  followUpQuestion: z.string().nullable(),
  /** §5.2/§28's context manifest: every record ID/version/classification/redaction actually used to answer this question. */
  contextManifest: z.array(coachingContextManifestEntrySchema),
});
export type CoachingResponse = z.infer<typeof coachingResponseSchema>;
