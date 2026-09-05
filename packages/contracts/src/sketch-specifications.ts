import { z } from "zod";

/**
 * Phase 6 request/response contracts: sketch specifications (PRD-AI-008,
 * README "AI coaching" -> "Sketch specifications", eighth slice; spec
 * §4.4/§28's `SketchInterpretation`). See packages/ai/src/prompts/
 * interpret-sketch.ts's doc comment for why this operates on a text
 * description rather than real sketch/canvas data - that storage is
 * explicitly Phase 8 work in the spec's own roadmap.
 */

export const proposeSketchSpecificationRequestSchema = z.object({
  description: z.string().trim().min(1).max(2000),
});
export type ProposeSketchSpecificationRequest = z.infer<
  typeof proposeSketchSpecificationRequestSchema
>;

export const sketchElementResponseSchema = z.object({
  label: z.string(),
  kind: z.string(),
});

export const possibleMappingResponseSchema = z.object({
  elementLabel: z.string(),
  suggestedStructuredType: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

/** No mutation - this is an interpretation only, never persisted or applied anywhere. */
export const sketchSpecificationSchema = z.object({
  observedElements: z.array(sketchElementResponseSchema),
  ambiguities: z.array(z.string()),
  proposedLabels: z.array(z.string()),
  possibleMappings: z.array(possibleMappingResponseSchema),
});
export type SketchSpecification = z.infer<typeof sketchSpecificationSchema>;
