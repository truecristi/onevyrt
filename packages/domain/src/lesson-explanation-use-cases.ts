import { eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import { requireOwnEnrollmentForBlock } from "./block-response-use-cases";
import { LessonNotFoundError } from "./errors";

/**
 * PRD-AI-005 vertical slice: lesson explanations (README "AI coaching" ->
 * "Lesson explanations", fifth slice of Phase 6; spec §7.1's "explain a
 * calculation or warning in plain language", applied here to lesson
 * content instead of a numeric calculation). Reuses
 * block-response-use-cases.ts's requireOwnEnrollmentForBlock - the exact
 * same ownership/scoping check (the enrollment is the caller's own, and
 * the block actually belongs to a lesson in that enrollment's program
 * version) every other learner-facing block interaction already uses, so
 * "explain this to me" can never be used to read a block from a program
 * version the caller isn't enrolled in.
 *
 * Rendering a block's payload generically (its own field names, not a
 * per-blockType switch over all 19 types from lesson-blocks.ts) is a
 * deliberate first-pass scoping choice - each block type's payload
 * genuinely differs, but every one of them is a flat, small object of
 * named fields, so listing them is enough context for an explanation
 * without hand-writing 19 renderers. A per-type renderer producing more
 * natural prose is a reasonable later enhancement, not required for this
 * slice to be useful.
 */

export interface LessonExplanationContext {
  lessonTitle: string;
  blockType: string;
  content: string;
}

function renderBlockPayload(payload: Record<string, unknown>): string {
  return Object.entries(payload)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join("\n");
}

export interface AssembleLessonExplanationContextInput {
  actorUserId: string;
  enrollmentId: string;
  lessonBlockId: string;
}

export async function assembleLessonExplanationContext(
  db: Database,
  input: AssembleLessonExplanationContextInput,
): Promise<LessonExplanationContext> {
  const block = await requireOwnEnrollmentForBlock(
    db,
    input.enrollmentId,
    input.lessonBlockId,
    input.actorUserId,
  );

  const lesson = await db.query.lessons.findFirst({
    where: eq(schema.lessons.id, block.lessonId),
  });
  // requireOwnEnrollmentForBlock already confirmed this lesson exists and
  // belongs to the enrolled program version - this can't actually miss,
  // but the type system doesn't know that, and failing closed here costs
  // nothing.
  if (!lesson) throw new LessonNotFoundError(block.lessonId);

  return {
    lessonTitle: lesson.title,
    blockType: block.blockType,
    // The jsonb column is typed as unknown at the drizzle layer; every
    // lesson block payload is validated at the API boundary
    // (packages/contracts/src/lesson-blocks.ts) to be a flat object of
    // named fields before it's ever written, so this cast reflects an
    // invariant already enforced elsewhere, not a new assumption.
    content: renderBlockPayload(block.payload as Record<string, unknown>),
  };
}
