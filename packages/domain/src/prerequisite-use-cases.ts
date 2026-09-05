import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import { isUniqueViolation } from "./db-errors";
import { requirePlatformAdmin, checkPlatformAdmin } from "./platform-admin-use-cases";
import { assertProgramVersionEditable, assertLessonVisible } from "./curriculum-use-cases";
import {
  LessonNotFoundError,
  SelfPrerequisiteError,
  PrerequisiteNotInSameVersionError,
  DuplicatePrerequisiteError,
  PrerequisiteNotFoundError,
  PrerequisitesNotMetError,
} from "./errors";

/**
 * PRD-CURRICULUM-006 vertical slice: prerequisites. Writes are platform-
 * admin-only and only permitted while the lesson's program version is
 * still draft - same editability rule as lessons and blocks. Both sides
 * of a prerequisite pair must be lessons in the same program version,
 * checked here rather than by the database (same tradeoff every other
 * cross-entity link in this schema makes).
 */

export interface LessonPrerequisiteRecord {
  id: string;
  lessonId: string;
  prerequisiteLessonId: string;
  createdAt: Date;
}

export interface AddPrerequisiteInput {
  actorUserId: string;
  lessonId: string;
  prerequisiteLessonId: string;
}

export async function addPrerequisite(
  db: Database,
  input: AddPrerequisiteInput,
): Promise<LessonPrerequisiteRecord> {
  await requirePlatformAdmin(db, input.actorUserId);

  if (input.lessonId === input.prerequisiteLessonId) {
    throw new SelfPrerequisiteError(input.lessonId);
  }

  const lesson = await db.query.lessons.findFirst({ where: eq(schema.lessons.id, input.lessonId) });
  if (!lesson) throw new LessonNotFoundError(input.lessonId);
  await assertProgramVersionEditable(db, lesson.programVersionId);

  const prerequisiteLesson = await db.query.lessons.findFirst({
    where: eq(schema.lessons.id, input.prerequisiteLessonId),
  });
  if (!prerequisiteLesson) throw new LessonNotFoundError(input.prerequisiteLessonId);
  if (prerequisiteLesson.programVersionId !== lesson.programVersionId) {
    throw new PrerequisiteNotInSameVersionError(input.lessonId, input.prerequisiteLessonId);
  }

  try {
    const [prerequisite] = await db
      .insert(schema.lessonPrerequisites)
      .values({ lessonId: input.lessonId, prerequisiteLessonId: input.prerequisiteLessonId })
      .returning();
    if (!prerequisite) throw new Error("Failed to add prerequisite");
    return prerequisite as LessonPrerequisiteRecord;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicatePrerequisiteError(input.lessonId, input.prerequisiteLessonId);
    }
    throw error;
  }
}

export interface RemovePrerequisiteInput {
  actorUserId: string;
  lessonId: string;
  prerequisiteLessonId: string;
}

export async function removePrerequisite(
  db: Database,
  input: RemovePrerequisiteInput,
): Promise<void> {
  await requirePlatformAdmin(db, input.actorUserId);

  const lesson = await db.query.lessons.findFirst({ where: eq(schema.lessons.id, input.lessonId) });
  if (!lesson) throw new LessonNotFoundError(input.lessonId);
  await assertProgramVersionEditable(db, lesson.programVersionId);

  const [deleted] = await db
    .delete(schema.lessonPrerequisites)
    .where(
      and(
        eq(schema.lessonPrerequisites.lessonId, input.lessonId),
        eq(schema.lessonPrerequisites.prerequisiteLessonId, input.prerequisiteLessonId),
      ),
    )
    .returning({ id: schema.lessonPrerequisites.id });
  if (!deleted) throw new PrerequisiteNotFoundError(input.lessonId, input.prerequisiteLessonId);
}

export interface ListPrerequisitesForLessonInput {
  actorUserId: string;
  lessonId: string;
}

export async function listPrerequisitesForLesson(
  db: Database,
  input: ListPrerequisitesForLessonInput,
): Promise<LessonPrerequisiteRecord[]> {
  const isAdmin = await checkPlatformAdmin(db, input.actorUserId);
  if (!isAdmin) {
    // Also throws LessonNotFoundError for a non-visible lesson - same
    // "don't leak which draft lesson IDs exist" rule as everywhere else.
    await assertLessonVisible(db, input.lessonId, input.actorUserId);
  } else {
    const lesson = await db.query.lessons.findFirst({
      where: eq(schema.lessons.id, input.lessonId),
    });
    if (!lesson) throw new LessonNotFoundError(input.lessonId);
  }

  const rows = await db
    .select()
    .from(schema.lessonPrerequisites)
    .where(eq(schema.lessonPrerequisites.lessonId, input.lessonId));
  return rows as LessonPrerequisiteRecord[];
}

/**
 * Exported for progress-use-cases.ts's startOrResumeLesson: throws
 * PrerequisitesNotMetError (naming which lessons are still incomplete)
 * unless every prerequisite lesson has a "completed" lesson_progress row
 * for this same enrollment. A lesson with no prerequisites always
 * passes trivially.
 */
export async function assertPrerequisitesMet(
  db: Database,
  enrollmentId: string,
  lessonId: string,
): Promise<void> {
  const prerequisites = await db
    .select({ prerequisiteLessonId: schema.lessonPrerequisites.prerequisiteLessonId })
    .from(schema.lessonPrerequisites)
    .where(eq(schema.lessonPrerequisites.lessonId, lessonId));
  if (prerequisites.length === 0) return;

  const prerequisiteIds = prerequisites.map((p) => p.prerequisiteLessonId);
  const completed = await db
    .select({ lessonId: schema.lessonProgress.lessonId })
    .from(schema.lessonProgress)
    .where(
      and(
        eq(schema.lessonProgress.enrollmentId, enrollmentId),
        inArray(schema.lessonProgress.lessonId, prerequisiteIds),
        eq(schema.lessonProgress.status, "completed"),
      ),
    );
  const completedIds = new Set(completed.map((c) => c.lessonId));
  const incomplete = prerequisiteIds.filter((id) => !completedIds.has(id));

  if (incomplete.length > 0) {
    throw new PrerequisitesNotMetError(lessonId, incomplete);
  }
}
