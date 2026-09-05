import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { LessonProgressStatus } from "@onevyrt/contracts";
import { isUniqueViolation } from "./db-errors";
import {
  ProgramVersionNotFoundError,
  LessonNotFoundError,
  LessonBlockNotFoundError,
  EnrollmentNotFoundError,
  AlreadyEnrolledError,
  LessonProgressNotFoundError,
} from "./errors";

/**
 * PRD-CURRICULUM-003 vertical slice: progress tracking and resume
 * behavior. Enrollments and progress belong to the individual learner's
 * own account (schema.ts's doc comment on the enrollments table explains
 * why) - every function here scopes by the caller's own userId, the same
 * "structurally impossible to return someone else's record" shape
 * listWorkspacesForUser uses for workspaces.
 */

export interface EnrollmentRecord {
  id: string;
  userId: string;
  programVersionId: string;
  status: "active" | "completed" | "withdrawn";
  enrolledAt: Date;
  completedAt: Date | null;
}

export interface EnrollInput {
  actorUserId: string;
  programVersionId: string;
}

/** A learner may only enroll in a *published* version - draft/archived versions raise the same ProgramVersionNotFoundError either way, not leaking which draft version IDs exist. */
export async function enroll(db: Database, input: EnrollInput): Promise<EnrollmentRecord> {
  const version = await db.query.programVersions.findFirst({
    where: eq(schema.programVersions.id, input.programVersionId),
  });
  if (!version || version.status !== "published") {
    throw new ProgramVersionNotFoundError(input.programVersionId);
  }

  try {
    const [enrollment] = await db
      .insert(schema.enrollments)
      .values({ userId: input.actorUserId, programVersionId: input.programVersionId })
      .returning();
    if (!enrollment) throw new Error("Failed to create enrollment");
    return enrollment as EnrollmentRecord;
  } catch (error) {
    if (isUniqueViolation(error)) throw new AlreadyEnrolledError(input.programVersionId);
    throw error;
  }
}

export interface ListMyEnrollmentsInput {
  actorUserId: string;
}

export async function listMyEnrollments(
  db: Database,
  input: ListMyEnrollmentsInput,
): Promise<EnrollmentRecord[]> {
  const rows = await db
    .select()
    .from(schema.enrollments)
    .where(eq(schema.enrollments.userId, input.actorUserId))
    .orderBy(desc(schema.enrollments.enrolledAt));
  return rows as EnrollmentRecord[];
}

export interface LessonProgressRecord {
  id: string;
  enrollmentId: string;
  lessonId: string;
  status: LessonProgressStatus;
  currentBlockId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}

/** Verifies the enrollment is the caller's own, and that the lesson actually belongs to the program version the enrollment is for - the same cross-entity link-integrity check evidence-use-cases.ts uses for assumption/decision links. */
async function requireOwnEnrollmentForLesson(
  db: Database,
  enrollmentId: string,
  lessonId: string,
  actorUserId: string,
): Promise<void> {
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(schema.enrollments.id, enrollmentId),
  });
  if (!enrollment || enrollment.userId !== actorUserId) {
    throw new EnrollmentNotFoundError(enrollmentId);
  }

  const lesson = await db.query.lessons.findFirst({ where: eq(schema.lessons.id, lessonId) });
  if (!lesson || lesson.programVersionId !== enrollment.programVersionId) {
    throw new LessonNotFoundError(lessonId);
  }
}

export interface StartOrResumeLessonInput {
  actorUserId: string;
  enrollmentId: string;
  lessonId: string;
}

/**
 * The resume mechanism: idempotent on purpose. The first call creates a
 * fresh "in_progress" record; every call after that just returns the
 * existing one unchanged, so the caller can call this on every lesson
 * open without worrying about resetting progress.
 */
export async function startOrResumeLesson(
  db: Database,
  input: StartOrResumeLessonInput,
): Promise<LessonProgressRecord> {
  await requireOwnEnrollmentForLesson(db, input.enrollmentId, input.lessonId, input.actorUserId);

  const existing = await db.query.lessonProgress.findFirst({
    where: and(
      eq(schema.lessonProgress.enrollmentId, input.enrollmentId),
      eq(schema.lessonProgress.lessonId, input.lessonId),
    ),
  });
  if (existing) return existing as LessonProgressRecord;

  const [progress] = await db
    .insert(schema.lessonProgress)
    .values({ enrollmentId: input.enrollmentId, lessonId: input.lessonId })
    .returning();
  if (!progress) throw new Error("Failed to start lesson progress");
  return progress as LessonProgressRecord;
}

export interface UpdateLessonProgressInput {
  actorUserId: string;
  enrollmentId: string;
  lessonId: string;
  /** undefined = leave unchanged; null = clear the resume point; a uuid = set it (validated to belong to this lesson). */
  currentBlockId?: string | null;
  status?: LessonProgressStatus;
}

export async function updateLessonProgress(
  db: Database,
  input: UpdateLessonProgressInput,
): Promise<LessonProgressRecord> {
  await requireOwnEnrollmentForLesson(db, input.enrollmentId, input.lessonId, input.actorUserId);

  if (input.currentBlockId !== undefined && input.currentBlockId !== null) {
    const block = await db.query.lessonBlocks.findFirst({
      where: eq(schema.lessonBlocks.id, input.currentBlockId),
    });
    if (!block || block.lessonId !== input.lessonId) {
      throw new LessonBlockNotFoundError(input.currentBlockId);
    }
  }

  return withTransaction(db, async (tx) => {
    const patch: Partial<typeof schema.lessonProgress.$inferInsert> = { updatedAt: new Date() };
    if (input.currentBlockId !== undefined) patch.currentBlockId = input.currentBlockId;
    if (input.status !== undefined) {
      patch.status = input.status;
      patch.completedAt = input.status === "completed" ? new Date() : null;
    }

    const [progress] = await tx
      .update(schema.lessonProgress)
      .set(patch)
      .where(
        and(
          eq(schema.lessonProgress.enrollmentId, input.enrollmentId),
          eq(schema.lessonProgress.lessonId, input.lessonId),
        ),
      )
      .returning();

    if (!progress) throw new LessonProgressNotFoundError(input.lessonId);
    return progress as LessonProgressRecord;
  });
}

export interface ListLessonProgressInput {
  actorUserId: string;
  enrollmentId: string;
}

export async function listLessonProgress(
  db: Database,
  input: ListLessonProgressInput,
): Promise<LessonProgressRecord[]> {
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(schema.enrollments.id, input.enrollmentId),
  });
  if (!enrollment || enrollment.userId !== input.actorUserId) {
    throw new EnrollmentNotFoundError(input.enrollmentId);
  }

  const rows = await db
    .select()
    .from(schema.lessonProgress)
    .where(eq(schema.lessonProgress.enrollmentId, input.enrollmentId));
  return rows as LessonProgressRecord[];
}
