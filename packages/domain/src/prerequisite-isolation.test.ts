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
import { enroll, startOrResumeLesson, updateLessonProgress } from "./progress-use-cases";
import {
  addPrerequisite,
  removePrerequisite,
  listPrerequisitesForLesson,
} from "./prerequisite-use-cases";
import {
  SelfPrerequisiteError,
  PrerequisiteNotInSameVersionError,
  DuplicatePrerequisiteError,
  PrerequisiteNotFoundError,
  ProgramVersionNotEditableError,
  PrerequisitesNotMetError,
} from "./errors";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("prerequisites (Phase 3 sixth slice)", () => {
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
      "lesson_prerequisites",
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

  it("rejects a non-admin adding a prerequisite", async () => {
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
    const lessonA = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "a",
      title: "A",
      outcome: "",
      orderIndex: 1,
    });
    const lessonB = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "b",
      title: "B",
      outcome: "",
      orderIndex: 2,
    });

    await expect(
      addPrerequisite(db, {
        actorUserId: learner.user.id,
        lessonId: lessonB.id,
        prerequisiteLessonId: lessonA.id,
      }),
    ).rejects.toThrow(PlatformAdminRequiredError);
  });

  it("rejects a lesson being its own prerequisite", async () => {
    const admin = await registerAdmin("admin2@example.com");
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
    const lesson = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "a",
      title: "A",
      outcome: "",
      orderIndex: 1,
    });

    await expect(
      addPrerequisite(db, {
        actorUserId: admin.user.id,
        lessonId: lesson.id,
        prerequisiteLessonId: lesson.id,
      }),
    ).rejects.toThrow(SelfPrerequisiteError);
  });

  it("rejects a prerequisite from a different program version, and a duplicate add", async () => {
    const admin = await registerAdmin("admin3@example.com");
    const programA = await createProgram(db, {
      actorUserId: admin.user.id,
      slug: "program-a",
      title: "A",
      summary: "",
      orderIndex: 1,
    });
    const versionA = await createProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: programA.id,
      version: 1,
      outcomes: "",
    });
    const lessonA = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: versionA.id,
      slug: "a",
      title: "A",
      outcome: "",
      orderIndex: 1,
    });

    const programB = await createProgram(db, {
      actorUserId: admin.user.id,
      slug: "program-b",
      title: "B",
      summary: "",
      orderIndex: 1,
    });
    const versionB = await createProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: programB.id,
      version: 1,
      outcomes: "",
    });
    const lessonB = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: versionB.id,
      slug: "b",
      title: "B",
      outcome: "",
      orderIndex: 1,
    });

    await expect(
      addPrerequisite(db, {
        actorUserId: admin.user.id,
        lessonId: lessonB.id,
        prerequisiteLessonId: lessonA.id,
      }),
    ).rejects.toThrow(PrerequisiteNotInSameVersionError);

    const lessonC = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: versionA.id,
      slug: "c",
      title: "C",
      outcome: "",
      orderIndex: 2,
    });
    await addPrerequisite(db, {
      actorUserId: admin.user.id,
      lessonId: lessonC.id,
      prerequisiteLessonId: lessonA.id,
    });
    await expect(
      addPrerequisite(db, {
        actorUserId: admin.user.id,
        lessonId: lessonC.id,
        prerequisiteLessonId: lessonA.id,
      }),
    ).rejects.toThrow(DuplicatePrerequisiteError);
  });

  it("blocks starting a lesson until its prerequisite is completed, then allows it", async () => {
    const admin = await registerAdmin("admin4@example.com");
    const learner = await registerLearner("learner4@example.com");
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
    const lessonA = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "a",
      title: "A",
      outcome: "",
      orderIndex: 1,
    });
    const lessonB = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "b",
      title: "B",
      outcome: "",
      orderIndex: 2,
    });
    await addPrerequisite(db, {
      actorUserId: admin.user.id,
      lessonId: lessonB.id,
      prerequisiteLessonId: lessonA.id,
    });
    await updateLesson(db, {
      actorUserId: admin.user.id,
      lessonId: lessonA.id,
      status: "published",
    });
    await updateLesson(db, {
      actorUserId: admin.user.id,
      lessonId: lessonB.id,
      status: "published",
    });
    await publishProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      programVersionId: version.id,
    });

    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });

    await expect(
      startOrResumeLesson(db, {
        actorUserId: learner.user.id,
        enrollmentId: enrollment.id,
        lessonId: lessonB.id,
      }),
    ).rejects.toThrow(PrerequisitesNotMetError);

    // Lesson A itself has no prerequisites - always allowed.
    await startOrResumeLesson(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lessonA.id,
    });
    await updateLessonProgress(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lessonA.id,
      status: "completed",
    });

    const started = await startOrResumeLesson(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lessonB.id,
    });
    expect(started.status).toBe("in_progress");
  });

  it("blocks editing prerequisites once the program version is published, and supports removal while still draft", async () => {
    const admin = await registerAdmin("admin5@example.com");
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
    const lessonA = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "a",
      title: "A",
      outcome: "",
      orderIndex: 1,
    });
    const lessonB = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "b",
      title: "B",
      outcome: "",
      orderIndex: 2,
    });
    await addPrerequisite(db, {
      actorUserId: admin.user.id,
      lessonId: lessonB.id,
      prerequisiteLessonId: lessonA.id,
    });

    const list = await listPrerequisitesForLesson(db, {
      actorUserId: admin.user.id,
      lessonId: lessonB.id,
    });
    expect(list.map((p) => p.prerequisiteLessonId)).toEqual([lessonA.id]);

    await removePrerequisite(db, {
      actorUserId: admin.user.id,
      lessonId: lessonB.id,
      prerequisiteLessonId: lessonA.id,
    });
    await expect(
      removePrerequisite(db, {
        actorUserId: admin.user.id,
        lessonId: lessonB.id,
        prerequisiteLessonId: lessonA.id,
      }),
    ).rejects.toThrow(PrerequisiteNotFoundError);

    await addPrerequisite(db, {
      actorUserId: admin.user.id,
      lessonId: lessonB.id,
      prerequisiteLessonId: lessonA.id,
    });
    await updateLesson(db, {
      actorUserId: admin.user.id,
      lessonId: lessonA.id,
      status: "published",
    });
    await updateLesson(db, {
      actorUserId: admin.user.id,
      lessonId: lessonB.id,
      status: "published",
    });
    await publishProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      programVersionId: version.id,
    });

    await expect(
      addPrerequisite(db, {
        actorUserId: admin.user.id,
        lessonId: lessonB.id,
        prerequisiteLessonId: lessonA.id,
      }),
    ).rejects.toThrow(ProgramVersionNotEditableError);
    await expect(
      removePrerequisite(db, {
        actorUserId: admin.user.id,
        lessonId: lessonB.id,
        prerequisiteLessonId: lessonA.id,
      }),
    ).rejects.toThrow(ProgramVersionNotEditableError);
  });
});
