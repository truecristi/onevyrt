import { z } from "zod";

/**
 * Phase 3 request/response contracts: knowledge-check and reflection
 * responses (PRD-CURRICULUM-005). Restricted for now to the two block
 * types that actually need a learner response - "Lesson application"
 * (a later slice) will extend this same discriminated union with
 * practice/build/implementation response shapes rather than introducing
 * a parallel table.
 *
 * A knowledge-check response never accepts isCorrect from the client -
 * that's computed server-side against the block's own correctOptionIndex
 * (block-response-use-cases.ts), so a learner can't spoof a correct
 * answer by crafting the request body.
 */

const knowledgeCheckResponse = z.object({
  blockType: z.literal("knowledge-check"),
  response: z.object({ selectedOptionIndex: z.number().int().min(0) }),
});

const reflectionResponse = z.object({
  blockType: z.literal("reflection"),
  response: z.object({
    text: z.string().trim().min(1).max(4000),
    confidenceRating: z.number().int().min(1).max(5).optional(),
  }),
});

export const submitBlockResponseRequestSchema = z.discriminatedUnion("blockType", [
  knowledgeCheckResponse,
  reflectionResponse,
]);
export type SubmitBlockResponseRequest = z.infer<typeof submitBlockResponseRequestSchema>;

export const blockResponseTypeSchema = z.enum(["knowledge-check", "reflection"]);
export type BlockResponseType = z.infer<typeof blockResponseTypeSchema>;

export const blockResponseSchema = z.object({
  id: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  lessonBlockId: z.string().uuid(),
  blockType: blockResponseTypeSchema,
  response: z.record(z.string(), z.unknown()),
  submittedAt: z.string(),
  updatedAt: z.string(),
});
export type BlockResponse = z.infer<typeof blockResponseSchema>;
