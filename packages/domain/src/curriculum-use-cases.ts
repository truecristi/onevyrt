import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { ContentStatus } from "@onevyrt/contracts";
import { requirePlatformAdmin, checkPlatformAdmin } from "./platform-admin-use-cases";
import { isUniqueViolation } from "./db-errors";
import {
  ProgramNotFoundError,
  DuplicateProgramSlugError,
  ProgramVersionNotFoundError,
  DuplicateProgramVersionError,
  ProgramVersionNotEditableError,
  LessonNotFoundError,
  DuplicateLessonSlugError,
} from "./errors";

/**
 * PRD-CURRICULUM-001 vertical slice: programs, program versions and
 * lessons. Unlike every Phase 2 use case, there is no workspace
 * membership check here - this content is platform-wide (see the doc
 * comment on schema.ts's programs table). Writes go through
 * requirePlatformAdmin; reads use checkPlatformAdmin to decide how much
 * to show - an admin sees every status, everyone else sees only
 * published content.
 */

export interface ProgramRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  orderIndex: number;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProgramInput {
  actorUserId: string;
  slug: string;
  title: string;
  summary: string;
  orderIndex: number;
}

export async function createProgram(
  db: Database,
  input: CreateProgramInput,
): Promise<ProgramRecord> {
  await requirePlatformAdmin(db, input.actorUserId);

  try {
    const [program] = await db
      .insert(schema.programs)
      .values({
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        orderIndex: input.orderIndex,
      })
      .returning();
    if (!program) throw new Error("Failed to create program");
    return program as ProgramRecord;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateProgramSlugError(input.slug);
    throw error;
  }
}

export interface ListProgramsInput {
  actorUserId: string;
}

export async function listPrograms(
  db: Database,
  input: ListProgramsInput,
): Promise<ProgramRecord[]> {
  const isAdmin = await checkPlatformAdmin(db, input.actorUserId);

  const rows = isAdmin
    ? await db.select().from(schema.programs).orderBy(asc(schema.programs.orderIndex))
    : await db
        .select()
        .from(schema.programs)
        .where(eq(schema.programs.status, "published"))
        .orderBy(asc(schema.programs.orderIndex));

  return rows as ProgramRecord[];
}

export interface UpdateProgramInput {
  actorUserId: string;
  programId: string;
  title?: string;
  summary?: string;
  orderIndex?: number;
  status?: ContentStatus;
}

export async function updateProgram(
  db: Database,
  input: UpdateProgramInput,
): Promise<ProgramRecord> {
  await requirePlatformAdmin(db, input.actorUserId);

  const patch: Partial<typeof schema.programs.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.orderIndex !== undefined) patch.orderIndex = input.orderIndex;
  if (input.status !== undefined) patch.status = input.status;

  const [program] = await db
    .update(schema.programs)
    .set(patch)
    .where(eq(schema.programs.id, input.programId))
    .returning();

  if (!program) throw new ProgramNotFoundError(input.programId);
  return program as ProgramRecord;
}

export interface ProgramVersionRecord {
  id: string;
  programId: string;
  version: number;
  status: ContentStatus;
  outcomes: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProgramVersionInput {
  actorUserId: string;
  programId: string;
  version: number;
  outcomes: string;
}

export async function createProgramVersion(
  db: Database,
  input: CreateProgramVersionInput,
): Promise<ProgramVersionRecord> {
  await requirePlatformAdmin(db, input.actorUserId);

  const program = await db.query.programs.findFirst({
    where: eq(schema.programs.id, input.programId),
  });
  if (!program) throw new ProgramNotFoundError(input.programId);

  try {
    const [version] = await db
      .insert(schema.programVersions)
      .values({ programId: input.programId, version: input.version, outcomes: input.outcomes })
      .returning();
    if (!version) throw new Error("Failed to create program version");
    return version as ProgramVersionRecord;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateProgramVersionError(input.programId, input.version);
    }
    throw error;
  }
}

export interface ListProgramVersionsInput {
  actorUserId: string;
  programId: string;
}

export async function listProgramVersions(
  db: Database,
  input: ListProgramVersionsInput,
): Promise<ProgramVersionRecord[]> {
  const isAdmin = await checkPlatformAdmin(db, input.actorUserId);

  const rows = isAdmin
    ? await db
        .select()
        .from(schema.programVersions)
        .where(eq(schema.programVersions.programId, input.programId))
        .orderBy(desc(schema.programVersions.version))
    : await db
        .select()
        .from(schema.programVersions)
        .where(
          and(
            eq(schema.programVersions.programId, input.programId),
            eq(schema.programVersions.status, "published"),
          ),
        )
        .orderBy(desc(schema.programVersions.version));

  return rows as ProgramVersionRecord[];
}

export interface PublishProgramVersionInput {
  actorUserId: string;
  programId: string;
  programVersionId: string;
}

/**
 * Publishing freezes the version for enrolled learners (spec section
 * 6.20). Archives any previously-published version of the same program
 * in the same transaction, so at most one is ever published at a time -
 * the partial unique index on programVersions (schema.ts) is the
 * backstop; this is the actual mechanism.
 */
export async function publishProgramVersion(
  db: Database,
  input: PublishProgramVersionInput,
): Promise<ProgramVersionRecord> {
  await requirePlatformAdmin(db, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const target = await tx.query.programVersions.findFirst({
      where: and(
        eq(schema.programVersions.id, input.programVersionId),
        eq(schema.programVersions.programId, input.programId),
      ),
    });
    if (!target) throw new ProgramVersionNotFoundError(input.programVersionId);

    await tx
      .update(schema.programVersions)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(
          eq(schema.programVersions.programId, input.programId),
          eq(schema.programVersions.status, "published"),
        ),
      );

    const [published] = await tx
      .update(schema.programVersions)
      .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.programVersions.id, input.programVersionId))
      .returning();
    if (!published) throw new ProgramVersionNotFoundError(input.programVersionId);

    return published as ProgramVersionRecord;
  });
}

export interface LessonRecord {
  id: string;
  programVersionId: string;
  slug: string;
  title: string;
  outcome: string;
  orderIndex: number;
  estimatedMinutes: number | null;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Exported for lesson-block-use-cases.ts, which needs the same "the parent program version must still be draft" gate. */
export async function assertProgramVersionEditable(
  db: Database,
  programVersionId: string,
): Promise<void> {
  const version = await db.query.programVersions.findFirst({
    where: eq(schema.programVersions.id, programVersionId),
  });
  if (!version) throw new ProgramVersionNotFoundError(programVersionId);
  if (version.status !== "draft") throw new ProgramVersionNotEditableError(programVersionId);
}

export interface CreateLessonInput {
  actorUserId: string;
  programVersionId: string;
  slug: string;
  title: string;
  outcome: string;
  orderIndex: number;
  estimatedMinutes?: number;
}

export async function createLesson(db: Database, input: CreateLessonInput): Promise<LessonRecord> {
  await requirePlatformAdmin(db, input.actorUserId);
  await assertProgramVersionEditable(db, input.programVersionId);

  try {
    const [lesson] = await db
      .insert(schema.lessons)
      .values({
        programVersionId: input.programVersionId,
        slug: input.slug,
        title: input.title,
        outcome: input.outcome,
        orderIndex: input.orderIndex,
        estimatedMinutes: input.estimatedMinutes ?? null,
      })
      .returning();
    if (!lesson) throw new Error("Failed to create lesson");
    return lesson as LessonRecord;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateLessonSlugError(input.slug);
    throw error;
  }
}

export interface ListLessonsInput {
  actorUserId: string;
  programVersionId: string;
}

/**
 * Non-admins can only see lessons of a published version, and only
 * published lessons within it - once a version is published it's frozen
 * (assertProgramVersionEditable), so a lesson left in "draft" at publish
 * time stays permanently hidden from learners until a new version
 * supersedes it. An unpublished/nonexistent version raises the same
 * ProgramVersionNotFoundError for a non-admin either way, rather than
 * leaking which draft version IDs exist.
 */
export async function listLessons(db: Database, input: ListLessonsInput): Promise<LessonRecord[]> {
  const isAdmin = await checkPlatformAdmin(db, input.actorUserId);

  if (isAdmin) {
    const rows = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.programVersionId, input.programVersionId))
      .orderBy(asc(schema.lessons.orderIndex));
    return rows as LessonRecord[];
  }

  const version = await db.query.programVersions.findFirst({
    where: eq(schema.programVersions.id, input.programVersionId),
  });
  if (!version || version.status !== "published") {
    throw new ProgramVersionNotFoundError(input.programVersionId);
  }

  const rows = await db
    .select()
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.programVersionId, input.programVersionId),
        eq(schema.lessons.status, "published"),
      ),
    )
    .orderBy(asc(schema.lessons.orderIndex));
  return rows as LessonRecord[];
}

export interface UpdateLessonInput {
  actorUserId: string;
  lessonId: string;
  title?: string;
  outcome?: string;
  orderIndex?: number;
  estimatedMinutes?: number | null;
  status?: ContentStatus;
}

export async function updateLesson(db: Database, input: UpdateLessonInput): Promise<LessonRecord> {
  await requirePlatformAdmin(db, input.actorUserId);

  const lesson = await db.query.lessons.findFirst({
    where: eq(schema.lessons.id, input.lessonId),
  });
  if (!lesson) throw new LessonNotFoundError(input.lessonId);
  await assertProgramVersionEditable(db, lesson.programVersionId);

  const patch: Partial<typeof schema.lessons.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.outcome !== undefined) patch.outcome = input.outcome;
  if (input.orderIndex !== undefined) patch.orderIndex = input.orderIndex;
  if (input.estimatedMinutes !== undefined) patch.estimatedMinutes = input.estimatedMinutes;
  if (input.status !== undefined) patch.status = input.status;

  const [updated] = await db
    .update(schema.lessons)
    .set(patch)
    .where(eq(schema.lessons.id, input.lessonId))
    .returning();

  if (!updated) throw new LessonNotFoundError(input.lessonId);
  return updated as LessonRecord;
}

/**
 * Exported for notes-bookmarks-use-cases.ts (and any future learner-
 * facing feature that references a lesson): returns the lesson if it's
 * visible to the caller - a platform admin sees any status, everyone
 * else only a lesson that is itself "published" in a "published"
 * program version - the same rule listLessons/listLessonBlocks apply.
 * Throws LessonNotFoundError otherwise, not leaking which draft lesson
 * IDs exist.
 */
export async function assertLessonVisible(
  db: Database,
  lessonId: string,
  actorUserId: string,
): Promise<LessonRecord> {
  const lesson = await db.query.lessons.findFirst({ where: eq(schema.lessons.id, lessonId) });
  if (!lesson) throw new LessonNotFoundError(lessonId);

  const isAdmin = await checkPlatformAdmin(db, actorUserId);
  if (isAdmin) return lesson as LessonRecord;

  const version = await db.query.programVersions.findFirst({
    where: eq(schema.programVersions.id, lesson.programVersionId),
  });
  if (lesson.status !== "published" || version?.status !== "published") {
    throw new LessonNotFoundError(lessonId);
  }
  return lesson as LessonRecord;
}
