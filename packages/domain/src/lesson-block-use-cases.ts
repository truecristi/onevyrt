import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { LessonBlockType } from "@onevyrt/contracts";
import { requirePlatformAdmin, checkPlatformAdmin } from "./platform-admin-use-cases";
import { assertProgramVersionEditable } from "./curriculum-use-cases";
import { LessonNotFoundError } from "./errors";

/**
 * PRD-CURRICULUM-002 vertical slice: structured lesson blocks. Create and
 * list only for this first pass - same incremental scoping as every
 * other slice in this codebase (update/delete of a block is a natural
 * follow-up once this path is proven).
 *
 * blockType/payload are already validated against the discriminated
 * union in @onevyrt/contracts by the time they reach here (same
 * boundary-validates, domain-trusts split as every other slice) - this
 * layer only enforces tenancy-independent authorization (platform admin)
 * and the "parent version still draft" editability rule.
 */

export interface LessonBlockRecord {
  id: string;
  lessonId: string;
  orderIndex: number;
  blockType: LessonBlockType;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLessonBlockInput {
  actorUserId: string;
  lessonId: string;
  orderIndex: number;
  blockType: LessonBlockType;
  payload: Record<string, unknown>;
}

export async function createLessonBlock(
  db: Database,
  input: CreateLessonBlockInput,
): Promise<LessonBlockRecord> {
  await requirePlatformAdmin(db, input.actorUserId);

  const lesson = await db.query.lessons.findFirst({
    where: eq(schema.lessons.id, input.lessonId),
  });
  if (!lesson) throw new LessonNotFoundError(input.lessonId);
  await assertProgramVersionEditable(db, lesson.programVersionId);

  return withTransaction(db, async (tx) => {
    const [block] = await tx
      .insert(schema.lessonBlocks)
      .values({
        lessonId: input.lessonId,
        orderIndex: input.orderIndex,
        blockType: input.blockType,
        payload: input.payload,
      })
      .returning();
    if (!block) throw new Error("Failed to create lesson block");
    return block as LessonBlockRecord;
  });
}

export interface ListLessonBlocksInput {
  actorUserId: string;
  lessonId: string;
}

/**
 * Non-admins can only see the blocks of a lesson that is itself visible
 * to them - published, in a published program version - same rule
 * listLessons applies to lessons themselves (curriculum-use-cases.ts). A
 * lesson that isn't visible raises LessonNotFoundError rather than
 * leaking which draft lesson IDs exist.
 */
export async function listLessonBlocks(
  db: Database,
  input: ListLessonBlocksInput,
): Promise<LessonBlockRecord[]> {
  const isAdmin = await checkPlatformAdmin(db, input.actorUserId);

  if (!isAdmin) {
    const visible = await db
      .select({ id: schema.lessons.id })
      .from(schema.lessons)
      .innerJoin(
        schema.programVersions,
        eq(schema.programVersions.id, schema.lessons.programVersionId),
      )
      .where(
        and(
          eq(schema.lessons.id, input.lessonId),
          eq(schema.lessons.status, "published"),
          eq(schema.programVersions.status, "published"),
        ),
      );
    if (visible.length === 0) throw new LessonNotFoundError(input.lessonId);
  } else {
    const lesson = await db.query.lessons.findFirst({
      where: eq(schema.lessons.id, input.lessonId),
    });
    if (!lesson) throw new LessonNotFoundError(input.lessonId);
  }

  const rows = await db
    .select()
    .from(schema.lessonBlocks)
    .where(eq(schema.lessonBlocks.lessonId, input.lessonId))
    .orderBy(asc(schema.lessonBlocks.orderIndex));

  return rows as LessonBlockRecord[];
}
