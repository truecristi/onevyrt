import { z } from "zod";

/**
 * Phase 3 request/response contracts: structured lesson blocks
 * (PRD-CURRICULUM-002). Spec section 21 names 19 block types, each with a
 * genuinely different shape - this is a discriminated union on
 * `blockType`, not one loose "payload: any" bag, so the API boundary
 * actually enforces which fields a given block type requires.
 *
 * Field choices for each payload come directly from how section 3.1 and
 * section 4 describe that piece of the lesson contract (cited inline) -
 * not invented. Fuller subsystems those sections also describe (the
 * visual-grammar rendering engine for `figure`, the metaphor engine's AI
 * proposal flow for `metaphor`) are out of scope here; this only captures
 * the authored content a curriculum admin enters; the rendering/engine
 * work is a later phase (per the existing packages/canvas, packages/ai
 * README stubs).
 */

export const lessonBlockTypeSchema = z.enum([
  "orientation",
  "concept",
  "why",
  "story",
  "metaphor",
  "figure",
  "worked-example",
  "counterexample",
  "calculation",
  "reflection",
  "knowledge-check",
  "practice",
  "build",
  "implementation",
  "coach-prompt",
  "evidence",
  "review",
  "celebration",
  "resource",
]);
export type LessonBlockType = z.infer<typeof lessonBlockTypeSchema>;

const orderIndexField = z.number().int().default(0);

// "a one-sentence outcome and prerequisite readiness" (section 3.1)
const orientationBlock = z.object({
  blockType: z.literal("orientation"),
  orderIndex: orderIndexField,
  payload: z.object({
    outcome: z.string().trim().min(1).max(300),
    prerequisiteCheck: z.string().trim().max(1000).default(""),
  }),
});

// "a concise concept explanation" (section 3.1)
const conceptBlock = z.object({
  blockType: z.literal("concept"),
  orderIndex: orderIndexField,
  payload: z.object({ explanation: z.string().trim().min(1).max(4000) }),
});

// "explicit 'why this matters'" (section 3.1)
const whyBlock = z.object({
  blockType: z.literal("why"),
  orderIndex: orderIndexField,
  payload: z.object({ explanation: z.string().trim().min(1).max(2000) }),
});

// "one positive example" (section 3.1)
const storyBlock = z.object({
  blockType: z.literal("story"),
  orderIndex: orderIndexField,
  payload: z.object({ narrative: z.string().trim().min(1).max(4000) }),
});

// "a metaphor with an explicit mapping table and a warning about where it
// breaks" (section 3.1); sourceDomain/targetConcept/mappingPairs/limitations
// per the metaphor engine's stored fields (section 4.3)
const metaphorBlock = z.object({
  blockType: z.literal("metaphor"),
  orderIndex: orderIndexField,
  payload: z.object({
    sourceDomain: z.string().trim().min(1).max(200),
    targetConcept: z.string().trim().min(1).max(200),
    mappingPairs: z
      .array(z.object({ source: z.string().trim().min(1), target: z.string().trim().min(1) }))
      .min(1),
    limitations: z.string().trim().min(1).max(1000),
  }),
});

// "an original visual explanation selected from the visual grammar"
// (section 3.1); the primitive/labels/data referenced from section 4.2 -
// the deterministic renderer itself is out of scope for this slice
const figureBlock = z.object({
  blockType: z.literal("figure"),
  orderIndex: orderIndexField,
  payload: z.object({
    primitiveType: z.string().trim().min(1).max(50),
    dataSummary: z.string().trim().max(2000).default(""),
    accessibilityDescription: z.string().trim().min(1).max(1000),
  }),
});

// "a worked numerical example where the concept affects money or
// capacity" (section 3.1)
const workedExampleBlock = z.object({
  blockType: z.literal("worked-example"),
  orderIndex: orderIndexField,
  payload: z.object({
    scenario: z.string().trim().min(1).max(2000),
    inputs: z.record(z.string(), z.number()).default({}),
    result: z.string().trim().min(1).max(1000),
  }),
});

// "one ... counterexample and one boundary case" (section 3.1)
const counterexampleBlock = z.object({
  blockType: z.literal("counterexample"),
  orderIndex: orderIndexField,
  payload: z.object({
    scenario: z.string().trim().min(1).max(2000),
    whyItFails: z.string().trim().min(1).max(1000),
  }),
});

// numerical/calculation content from the numbers system (section 7):
// "formula; worked example; user inputs; ... result"
const calculationBlock = z.object({
  blockType: z.literal("calculation"),
  orderIndex: orderIndexField,
  payload: z.object({
    formula: z.string().trim().min(1).max(500),
    inputs: z.record(z.string(), z.number()).default({}),
    result: z.string().trim().min(1).max(500),
  }),
});

// "a guided reflection and confidence rating" (section 3.1)
const reflectionBlock = z.object({
  blockType: z.literal("reflection"),
  orderIndex: orderIndexField,
  payload: z.object({
    prompt: z.string().trim().min(1).max(1000),
    collectConfidenceRating: z.boolean().default(true),
  }),
});

// "a comprehension check that tests transfer, not memorisation"
// (section 3.1)
const knowledgeCheckBlock = z.object({
  blockType: z.literal("knowledge-check"),
  orderIndex: orderIndexField,
  payload: z.object({
    question: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1)).min(2).max(8),
    correctOptionIndex: z.number().int().min(0),
    explanation: z.string().trim().max(1000).default(""),
  }),
});

// generic hands-on practice, distinct from the canonical-asset-producing
// "build" block below
const practiceBlock = z.object({
  blockType: z.literal("practice"),
  orderIndex: orderIndexField,
  payload: z.object({ instructions: z.string().trim().min(1).max(2000) }),
});

// "a structured build activity that creates or updates a canonical
// asset" (section 3.1)
const buildBlock = z.object({
  blockType: z.literal("build"),
  orderIndex: orderIndexField,
  payload: z.object({
    instructions: z.string().trim().min(1).max(2000),
    targetAsset: z.string().trim().min(1).max(200),
  }),
});

// "an implementation action with owner, deadline and evidence"
// (section 3.1)
const implementationBlock = z.object({
  blockType: z.literal("implementation"),
  orderIndex: orderIndexField,
  payload: z.object({
    action: z.string().trim().min(1).max(1000),
    ownerRole: z.string().trim().max(200).default(""),
    deadlineDays: z.number().int().positive().optional(),
  }),
});

// "optional coach gate and rubric" (section 3.1)
const coachPromptBlock = z.object({
  blockType: z.literal("coach-prompt"),
  orderIndex: orderIndexField,
  payload: z.object({
    question: z.string().trim().min(1).max(1000),
    rubric: z.string().trim().max(2000).default(""),
  }),
});

// prompts the learner to attach supporting evidence (the Evidence node,
// section 3.2) for a claim made in this lesson
const evidenceBlock = z.object({
  blockType: z.literal("evidence"),
  orderIndex: orderIndexField,
  payload: z.object({ instructions: z.string().trim().min(1).max(1000) }),
});

// "a review date, actual result and revise/continue/stop decision"
// (section 3.1)
const reviewBlock = z.object({
  blockType: z.literal("review"),
  orderIndex: orderIndexField,
  payload: z.object({ reviewPrompt: z.string().trim().min(1).max(1000) }),
});

const celebrationBlock = z.object({
  blockType: z.literal("celebration"),
  orderIndex: orderIndexField,
  payload: z.object({ message: z.string().trim().min(1).max(500) }),
});

// "sources, rights metadata" (section 3.1)
const resourceBlock = z.object({
  blockType: z.literal("resource"),
  orderIndex: orderIndexField,
  payload: z.object({
    title: z.string().trim().min(1).max(200),
    url: z.string().trim().url(),
    description: z.string().trim().max(1000).default(""),
  }),
});

export const createLessonBlockRequestSchema = z.discriminatedUnion("blockType", [
  orientationBlock,
  conceptBlock,
  whyBlock,
  storyBlock,
  metaphorBlock,
  figureBlock,
  workedExampleBlock,
  counterexampleBlock,
  calculationBlock,
  reflectionBlock,
  knowledgeCheckBlock,
  practiceBlock,
  buildBlock,
  implementationBlock,
  coachPromptBlock,
  evidenceBlock,
  reviewBlock,
  celebrationBlock,
  resourceBlock,
]);
export type CreateLessonBlockRequest = z.infer<typeof createLessonBlockRequestSchema>;

export const lessonBlockSchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid(),
  orderIndex: z.number(),
  blockType: lessonBlockTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LessonBlock = z.infer<typeof lessonBlockSchema>;
