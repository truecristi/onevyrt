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
import { createLessonBlock, listLessonBlocks } from "./lesson-block-use-cases";
import { LessonNotFoundError, ProgramVersionNotEditableError } from "./errors";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("lesson blocks (Phase 3 second slice)", () => {
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

  async function setUpDraftLesson(adminUserId: string) {
    const program = await createProgram(db, {
      actorUserId: adminUserId,
      slug: "orientation",
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
      slug: "goals-and-baseline",
      title: "Goals and baseline",
      outcome: "",
      orderIndex: 1,
    });
    return { program, version, lesson };
  }

  it("rejects block creation from a non-admin", async () => {
    const admin = await registerAdmin("admin@example.com");
    const learner = await registerLearner("learner@example.com");
    const { lesson } = await setUpDraftLesson(admin.user.id);

    await expect(
      createLessonBlock(db, {
        actorUserId: learner.user.id,
        lessonId: lesson.id,
        orderIndex: 1,
        blockType: "concept",
        payload: { explanation: "Should fail" },
      }),
    ).rejects.toThrow(PlatformAdminRequiredError);
  });

  it("creates blocks of different types on a draft lesson and lists them in order", async () => {
    const admin = await registerAdmin("admin2@example.com");
    const { lesson } = await setUpDraftLesson(admin.user.id);

    const second = await createLessonBlock(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      orderIndex: 2,
      blockType: "knowledge-check",
      payload: { question: "What is your goal?", options: ["A", "B"], correctOptionIndex: 0 },
    });
    const first = await createLessonBlock(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      orderIndex: 1,
      blockType: "concept",
      payload: { explanation: "A goal is a measurable target." },
    });

    const blocks = await listLessonBlocks(db, { actorUserId: admin.user.id, lessonId: lesson.id });
    expect(blocks.map((b) => b.id)).toEqual([first.id, second.id]);
    expect(blocks[0]?.blockType).toBe("concept");
    expect(blocks[1]?.blockType).toBe("knowledge-check");
  });

  it("throws LessonNotFoundError creating a block on a nonexistent lesson", async () => {
    const admin = await registerAdmin("admin3@example.com");
    await expect(
      createLessonBlock(db, {
        actorUserId: admin.user.id,
        lessonId: "00000000-0000-0000-0000-000000000000",
        orderIndex: 1,
        blockType: "concept",
        payload: { explanation: "Should fail" },
      }),
    ).rejects.toThrow(LessonNotFoundError);
  });

  it("blocks creating a block once the parent program version is published", async () => {
    const admin = await registerAdmin("admin4@example.com");
    const { program, version, lesson } = await setUpDraftLesson(admin.user.id);
    await updateLesson(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      status: "published",
    });
    await publishProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      programVersionId: version.id,
    });

    await expect(
      createLessonBlock(db, {
        actorUserId: admin.user.id,
        lessonId: lesson.id,
        orderIndex: 1,
        blockType: "concept",
        payload: { explanation: "Too late" },
      }),
    ).rejects.toThrow(ProgramVersionNotEditableError);
  });

  it("hides a draft lesson's blocks from a learner, and shows them once the lesson and version are published", async () => {
    const admin = await registerAdmin("admin5@example.com");
    const learner = await registerLearner("learner5@example.com");
    const { program, version, lesson } = await setUpDraftLesson(admin.user.id);

    await createLessonBlock(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      orderIndex: 1,
      blockType: "concept",
      payload: { explanation: "A goal is a measurable target." },
    });

    await expect(
      listLessonBlocks(db, { actorUserId: learner.user.id, lessonId: lesson.id }),
    ).rejects.toThrow(LessonNotFoundError);

    await updateLesson(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      status: "published",
    });
    await publishProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      programVersionId: version.id,
    });

    const blocks = await listLessonBlocks(db, {
      actorUserId: learner.user.id,
      lessonId: lesson.id,
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.blockType).toBe("concept");
  });
});
