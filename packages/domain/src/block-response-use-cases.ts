import { and, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import type { BlockResponseType } from "@onevyrt/contracts";
import {
  EnrollmentNotFoundError,
  LessonNotFoundError,
  LessonBlockNotFoundError,
  BlockTypeMismatchError,
} from "./errors";

/**
 * PRD-CURRICULUM-005 vertical slice: knowledge-check and reflection
 * responses. Same ownership shape as progress-use-cases.ts: every
 * function verifies the enrollment is the caller's own and that the
 * block actually belongs to a lesson in that enrollment's program
 * version, before touching a response.
 */

export interface BlockResponseRecord {
  id: string;
  enrollmentId: string;
  lessonBlockId: string;
  blockType: BlockResponseType;
  response: Record<string, unknown>;
  submittedAt: Date;
  updatedAt: Date;
}

/** Verifies ownership and returns the block's own row (its payload is needed by submitBlockResponse to grade a knowledge-check). */
async function requireOwnEnrollmentForBlock(
  db: Database,
  enrollmentId: string,
  lessonBlockId: string,
  actorUserId: string,
) {
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(schema.enrollments.id, enrollmentId),
  });
  if (!enrollment || enrollment.userId !== actorUserId) {
    throw new EnrollmentNotFoundError(enrollmentId);
  }

  const block = await db.query.lessonBlocks.findFirst({
    where: eq(schema.lessonBlocks.id, lessonBlockId),
  });
  if (!block) throw new LessonBlockNotFoundError(lessonBlockId);

  const lesson = await db.query.lessons.findFirst({
    where: eq(schema.lessons.id, block.lessonId),
  });
  if (!lesson || lesson.programVersionId !== enrollment.programVersionId) {
    throw new LessonNotFoundError(block.lessonId);
  }

  return block;
}

export interface SubmitKnowledgeCheckResponseInput {
  actorUserId: string;
  enrollmentId: string;
  lessonBlockId: string;
  selectedOptionIndex: number;
}

/**
 * Grades server-side against the block's own correctOptionIndex - a
 * learner can never spoof isCorrect by crafting the request body, since
 * it isn't accepted as input at all (see the contracts.ts doc comment).
 * Resubmitting overwrites the previous response (upsert on the
 * enrollment+block unique constraint) - "your current answer", not an
 * attempt log.
 */
export async function submitKnowledgeCheckResponse(
  db: Database,
  input: SubmitKnowledgeCheckResponseInput,
): Promise<BlockResponseRecord> {
  const block = await requireOwnEnrollmentForBlock(
    db,
    input.enrollmentId,
    input.lessonBlockId,
    input.actorUserId,
  );
  if (block.blockType !== "knowledge-check") {
    throw new BlockTypeMismatchError(input.lessonBlockId, "knowledge-check", block.blockType);
  }

  const payload = block.payload as { correctOptionIndex?: number };
  const isCorrect = payload.correctOptionIndex === input.selectedOptionIndex;

  const [response] = await db
    .insert(schema.blockResponses)
    .values({
      enrollmentId: input.enrollmentId,
      lessonBlockId: input.lessonBlockId,
      blockType: "knowledge-check",
      response: { selectedOptionIndex: input.selectedOptionIndex, isCorrect },
    })
    .onConflictDoUpdate({
      target: [schema.blockResponses.enrollmentId, schema.blockResponses.lessonBlockId],
      set: {
        response: { selectedOptionIndex: input.selectedOptionIndex, isCorrect },
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!response) throw new Error("Failed to record knowledge check response");
  return response as BlockResponseRecord;
}

export interface SubmitReflectionResponseInput {
  actorUserId: string;
  enrollmentId: string;
  lessonBlockId: string;
  text: string;
  confidenceRating?: number;
}

export async function submitReflectionResponse(
  db: Database,
  input: SubmitReflectionResponseInput,
): Promise<BlockResponseRecord> {
  const block = await requireOwnEnrollmentForBlock(
    db,
    input.enrollmentId,
    input.lessonBlockId,
    input.actorUserId,
  );
  if (block.blockType !== "reflection") {
    throw new BlockTypeMismatchError(input.lessonBlockId, "reflection", block.blockType);
  }

  const responseValue = {
    text: input.text,
    ...(input.confidenceRating !== undefined ? { confidenceRating: input.confidenceRating } : {}),
  };

  const [response] = await db
    .insert(schema.blockResponses)
    .values({
      enrollmentId: input.enrollmentId,
      lessonBlockId: input.lessonBlockId,
      blockType: "reflection",
      response: responseValue,
    })
    .onConflictDoUpdate({
      target: [schema.blockResponses.enrollmentId, schema.blockResponses.lessonBlockId],
      set: { response: responseValue, updatedAt: new Date() },
    })
    .returning();
  if (!response) throw new Error("Failed to record reflection response");
  return response as BlockResponseRecord;
}

export interface ListBlockResponsesForLessonInput {
  actorUserId: string;
  enrollmentId: string;
  lessonId: string;
}

export async function listBlockResponsesForLesson(
  db: Database,
  input: ListBlockResponsesForLessonInput,
): Promise<BlockResponseRecord[]> {
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(schema.enrollments.id, input.enrollmentId),
  });
  if (!enrollment || enrollment.userId !== input.actorUserId) {
    throw new EnrollmentNotFoundError(input.enrollmentId);
  }

  const lesson = await db.query.lessons.findFirst({ where: eq(schema.lessons.id, input.lessonId) });
  if (!lesson || lesson.programVersionId !== enrollment.programVersionId) {
    throw new LessonNotFoundError(input.lessonId);
  }

  const rows = await db
    .select({
      id: schema.blockResponses.id,
      enrollmentId: schema.blockResponses.enrollmentId,
      lessonBlockId: schema.blockResponses.lessonBlockId,
      blockType: schema.blockResponses.blockType,
      response: schema.blockResponses.response,
      submittedAt: schema.blockResponses.submittedAt,
      updatedAt: schema.blockResponses.updatedAt,
    })
    .from(schema.blockResponses)
    .innerJoin(schema.lessonBlocks, eq(schema.lessonBlocks.id, schema.blockResponses.lessonBlockId))
    .where(
      and(
        eq(schema.blockResponses.enrollmentId, input.enrollmentId),
        eq(schema.lessonBlocks.lessonId, input.lessonId),
      ),
    );

  return rows as BlockResponseRecord[];
}
