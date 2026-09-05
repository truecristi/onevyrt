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
import {
  enroll,
  listMyEnrollments,
  startOrResumeLesson,
  updateLessonProgress,
  listLessonProgress,
} from "./progress-use-cases";
import {
  ProgramVersionNotFoundError,
  AlreadyEnrolledError,
  EnrollmentNotFoundError,
  LessonNotFoundError,
  LessonBlockNotFoundError,
} from "./errors";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("progress tracking and resume behavior (Phase 3 third slice)", () => {
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

  /** Builds a published program version with one published lesson and one block, ready to enroll in. */
  async function setUpPublishedProgram(adminUserId: string) {
    programSlugCounter += 1;
    const program = await createProgram(db, {
      actorUserId: adminUserId,
      slug: `orientation-${programSlugCounter}`,
      title: "Orientation",
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
      slug: "goals",
      title: "Goals",
      outcome: "",
      orderIndex: 1,
    });
    const block = await createLessonBlock(db, {
      actorUserId: adminUserId,
      lessonId: lesson.id,
      orderIndex: 1,
      blockType: "concept",
      payload: { explanation: "A goal is a measurable target." },
    });
    await updateLesson(db, { actorUserId: adminUserId, lessonId: lesson.id, status: "published" });
    await publishProgramVersion(db, {
      actorUserId: adminUserId,
      programId: program.id,
      programVersionId: version.id,
    });
    return { program, version, lesson, block };
  }

  it("rejects enrolling in a draft program version", async () => {
    const admin = await registerAdmin("admin@example.com");
    const learner = await registerLearner("learner@example.com");
    const program = await createProgram(db, {
      actorUserId: admin.user.id,
      slug: "orientation",
      title: "Orientation",
      summary: "",
      orderIndex: 1,
    });
    const version = await createProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      version: 1,
      outcomes: "",
    });

    await expect(
      enroll(db, { actorUserId: learner.user.id, programVersionId: version.id }),
    ).rejects.toThrow(ProgramVersionNotFoundError);
  });

  it("enrolls in a published version, lists it, and rejects re-enrolling", async () => {
    const admin = await registerAdmin("admin2@example.com");
    const learner = await registerLearner("learner2@example.com");
    const { version } = await setUpPublishedProgram(admin.user.id);

    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });
    expect(enrollment.status).toBe("active");
    expect(enrollment.completedAt).toBeNull();

    const enrollments = await listMyEnrollments(db, { actorUserId: learner.user.id });
    expect(enrollments.map((e) => e.id)).toEqual([enrollment.id]);

    await expect(
      enroll(db, { actorUserId: learner.user.id, programVersionId: version.id }),
    ).rejects.toThrow(AlreadyEnrolledError);
  });

  it("starts progress on first open, resumes unchanged on a second open, and tracks the current block", async () => {
    const admin = await registerAdmin("admin3@example.com");
    const learner = await registerLearner("learner3@example.com");
    const { version, lesson, block } = await setUpPublishedProgram(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });

    const started = await startOrResumeLesson(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
    });
    expect(started.status).toBe("in_progress");
    expect(started.currentBlockId).toBeNull();

    const moved = await updateLessonProgress(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
      currentBlockId: block.id,
    });
    expect(moved.currentBlockId).toBe(block.id);

    // Resuming (calling startOrResumeLesson again) must not reset the
    // saved position - it's idempotent, not a fresh start.
    const resumed = await startOrResumeLesson(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
    });
    expect(resumed.id).toBe(started.id);
    expect(resumed.currentBlockId).toBe(block.id);
  });

  it("sets completedAt when marked completed and clears it on returning to in_progress", async () => {
    const admin = await registerAdmin("admin4@example.com");
    const learner = await registerLearner("learner4@example.com");
    const { version, lesson } = await setUpPublishedProgram(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });
    await startOrResumeLesson(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
    });

    const completed = await updateLessonProgress(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
      status: "completed",
    });
    expect(completed.completedAt).not.toBeNull();

    const reopened = await updateLessonProgress(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
      status: "in_progress",
    });
    expect(reopened.completedAt).toBeNull();

    const all = await listLessonProgress(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
    });
    expect(all.map((p) => p.id)).toEqual([reopened.id]);
  });

  it("rejects setting a currentBlockId that belongs to a different lesson", async () => {
    const admin = await registerAdmin("admin5@example.com");
    const learner = await registerLearner("learner5@example.com");
    const { version, lesson } = await setUpPublishedProgram(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });
    await startOrResumeLesson(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
    });

    await expect(
      updateLessonProgress(db, {
        actorUserId: learner.user.id,
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        currentBlockId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(LessonBlockNotFoundError);
  });

  it("prevents one learner from touching another learner's enrollment or progress", async () => {
    const admin = await registerAdmin("admin6@example.com");
    const alice = await registerLearner("alice6@example.com");
    const bob = await registerLearner("bob6@example.com");
    const { version, lesson } = await setUpPublishedProgram(admin.user.id);

    const alicesEnrollment = await enroll(db, {
      actorUserId: alice.user.id,
      programVersionId: version.id,
    });
    await startOrResumeLesson(db, {
      actorUserId: alice.user.id,
      enrollmentId: alicesEnrollment.id,
      lessonId: lesson.id,
    });

    await expect(
      startOrResumeLesson(db, {
        actorUserId: bob.user.id,
        enrollmentId: alicesEnrollment.id,
        lessonId: lesson.id,
      }),
    ).rejects.toThrow(EnrollmentNotFoundError);

    await expect(
      updateLessonProgress(db, {
        actorUserId: bob.user.id,
        enrollmentId: alicesEnrollment.id,
        lessonId: lesson.id,
        status: "completed",
      }),
    ).rejects.toThrow(EnrollmentNotFoundError);

    await expect(
      listLessonProgress(db, { actorUserId: bob.user.id, enrollmentId: alicesEnrollment.id }),
    ).rejects.toThrow(EnrollmentNotFoundError);

    // Bob's own list of enrollments never includes Alice's.
    const bobsEnrollments = await listMyEnrollments(db, { actorUserId: bob.user.id });
    expect(bobsEnrollments).toHaveLength(0);
  });

  it("rejects recording progress on a lesson that isn't part of the enrolled program version", async () => {
    const admin = await registerAdmin("admin7@example.com");
    const learner = await registerLearner("learner7@example.com");
    const { version, lesson } = await setUpPublishedProgram(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });

    // A second, unrelated published program/lesson the learner never enrolled in.
    const { lesson: otherLesson } = await setUpPublishedProgram(admin.user.id);
    void lesson;

    await expect(
      startOrResumeLesson(db, {
        actorUserId: learner.user.id,
        enrollmentId: enrollment.id,
        lessonId: otherLesson.id,
      }),
    ).rejects.toThrow(LessonNotFoundError);
  });
});
