import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, schema, type Database } from "@onevyrt/database";
import { eq } from "drizzle-orm";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import {
  createProgram,
  createProgramVersion,
  publishProgramVersion,
  createLesson,
  updateLesson,
} from "./curriculum-use-cases";
import { createLessonBlock } from "./lesson-block-use-cases";
import { enroll } from "./progress-use-cases";
import { assembleLessonExplanationContext } from "./lesson-explanation-use-cases";
import { EnrollmentNotFoundError, LessonNotFoundError } from "./errors";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("lesson explanations (Phase 6 fifth slice)", () => {
  let db: Database;
  let pool: Pool;
  let cleanupClient: Client;

  beforeAll(async () => {
    await runMigrations(TEST_DATABASE_URL);
    const created = createDatabase(TEST_DATABASE_URL);
    db = created.db;
    pool = created.pool;
    cleanupClient = new Client({ connectionString: TEST_DATABASE_URL });
    await cleanupClient.connect();
  });

  afterAll(async () => {
    await pool.end();
    await cleanupClient.end();
  });

  beforeEach(async () => {
    await truncateTables(cleanupClient, [
      "block_responses",
      "notes",
      "bookmarks",
      "lesson_progress",
      "enrollments",
      "lesson_blocks",
      "lessons",
      "program_versions",
      "programs",
      "evidence",
      "decisions",
      "assumptions",
      "business_metrics",
      "tasks",
      "offers",
      "customer_profiles",
      "goals",
      "business_profiles",
      "audit_log",
      "sessions",
      "workspace_members",
      "workspaces",
      "users",
    ]);
  });

  async function registerAdmin(email: string) {
    const result = await registerUser(db, AUTH_SECRET, {
      email,
      password: "correct-horse-battery-staple",
      workspaceName: `${email}'s workspace`,
    });
    await db
      .update(schema.users)
      .set({ isPlatformAdmin: true })
      .where(eq(schema.users.id, result.user.id));
    return result;
  }

  async function registerLearner(email: string) {
    return registerUser(db, AUTH_SECRET, {
      email,
      password: "correct-horse-battery-staple",
      workspaceName: `${email}'s workspace`,
    });
  }

  let programSlugCounter = 0;

  async function setUpPublishedLessonWithBlock(adminUserId: string) {
    programSlugCounter += 1;
    const program = await createProgram(db, {
      actorUserId: adminUserId,
      slug: `explain-${programSlugCounter}`,
      title: "Explain",
      summary: "",
      orderIndex: 1,
    });
    const version = await createProgramVersion(db, {
      actorUserId: adminUserId,
      programId: program.id,
      version: 1,
      outcomes: "",
    });
    const lesson = await createLesson(db, {
      actorUserId: adminUserId,
      programVersionId: version.id,
      slug: "concept",
      title: "Contribution margin",
      outcome: "",
      orderIndex: 1,
    });
    const block = await createLessonBlock(db, {
      actorUserId: adminUserId,
      lessonId: lesson.id,
      orderIndex: 1,
      blockType: "concept",
      payload: { explanation: "Contribution margin is price minus variable cost, per unit." },
    });
    await updateLesson(db, { actorUserId: adminUserId, lessonId: lesson.id, status: "published" });
    await publishProgramVersion(db, {
      actorUserId: adminUserId,
      programId: program.id,
      programVersionId: version.id,
    });
    return { program, version, lesson, block };
  }

  it("assembles the lesson title, block type and rendered payload for an enrolled learner", async () => {
    const admin = await registerAdmin("admin@example.com");
    const learner = await registerLearner("learner@example.com");
    const { version, lesson, block } = await setUpPublishedLessonWithBlock(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });

    const context = await assembleLessonExplanationContext(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonBlockId: block.id,
    });

    expect(context.lessonTitle).toBe(lesson.title);
    expect(context.blockType).toBe("concept");
    expect(context.content).toContain("Contribution margin is price minus variable cost");
  });

  it("throws EnrollmentNotFoundError for another learner's enrollment", async () => {
    const admin = await registerAdmin("admin2@example.com");
    const learner = await registerLearner("learner2@example.com");
    const otherLearner = await registerLearner("other2@example.com");
    const { version, block } = await setUpPublishedLessonWithBlock(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });

    await expect(
      assembleLessonExplanationContext(db, {
        actorUserId: otherLearner.user.id,
        enrollmentId: enrollment.id,
        lessonBlockId: block.id,
      }),
    ).rejects.toThrow(EnrollmentNotFoundError);
  });

  it("throws LessonNotFoundError for a block outside the enrolled program version", async () => {
    const admin = await registerAdmin("admin3@example.com");
    const learner = await registerLearner("learner3@example.com");
    const { version } = await setUpPublishedLessonWithBlock(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });
    const { block: otherBlock } = await setUpPublishedLessonWithBlock(admin.user.id);

    await expect(
      assembleLessonExplanationContext(db, {
        actorUserId: learner.user.id,
        enrollmentId: enrollment.id,
        lessonBlockId: otherBlock.id,
      }),
    ).rejects.toThrow(LessonNotFoundError);
  });
});
