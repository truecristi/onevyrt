import { z } from "zod";

/**
 * Phase 6 response contract: AI call records (PRD-AI-010, README
 * "AI coaching" -> "Cost and latency tracking", tenth slice). Read-only -
 * these rows are written internally by recordAiCall (packages/domain),
 * never by a client request, so there is no create-request schema here.
 */

export const aiCallRecordSchema = z.object({
  id: z.string().uuid(),
  actorUserId: z.string().uuid(),
  /** Null when the call happened outside a workspace context (e.g. a lesson explanation). */
  workspaceId: z.string().uuid().nullable(),
  promptTemplateKey: z.string(),
  promptTemplateVersion: z.number().int(),
  providerId: z.string(),
  model: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  latencyMs: z.number().int(),
  /** USD micros (1,000,000 = $1) - an estimate, not authoritative billing; null when the model has no known price. */
  estimatedCostMicros: z.number().int().nullable(),
  createdAt: z.string(),
});
export type AiCallRecord = z.infer<typeof aiCallRecordSchema>;
