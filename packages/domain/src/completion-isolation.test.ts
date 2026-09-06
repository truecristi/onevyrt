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
import { enroll, startOrResumeLesson, updateLessonProgress } from "./progress-use-cases";
import { submitKnowledgeCheckResponse, submitReflectionResponse } from "./block-response-use-cases";
import { submitLessonApplication } from "./lesson-application-use-cases";
import { createGoal } from "./business-core-use-cases";
import { LessonCompletionRequirementsNotMetError } from "./errors";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("completion rules (Phase 3 eighth slice)", () => {
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
      "lesson_applications",
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

  it("blocks completing a lesson with an unanswered knowledge check, then allows it once answered", async () => {
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
    const lesson = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "goals",
      title: "Goals",
      outcome: "",
      orderIndex: 1,
    });
    const kc = await createLessonBlock(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      orderIndex: 1,
      blockType: "knowledge-check",
      payload: { question: "What is a goal?", options: ["A", "B"], correctOptionIndex: 0 },
    });
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
        status: "completed",
      }),
    ).rejects.toThrow(LessonCompletionRequirementsNotMetError);

    await submitKnowledgeCheckResponse(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonBlockId: kc.id,
      selectedOptionIndex: 1,
    });

    const completed = await updateLessonProgress(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
      status: "completed",
    });
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).not.toBeNull();
  });

  it("blocks completing a lesson with an unanswered reflection", async () => {
    const admin = await registerAdmin("admin2@example.com");
    const learner = await registerLearner("learner2@example.com");
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
      slug: "goals",
      title: "Goals",
      outcome: "",
      orderIndex: 1,
    });
    const reflection = await createLessonBlock(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      orderIndex: 1,
      blockType: "reflection",
      payload: { prompt: "How confident are you?" },
    });
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
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });
    await startOrResumeLesson(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
    });

    const error = await updateLessonProgress(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
      status: "completed",
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LessonCompletionRequirementsNotMetError);
    if (error instanceof LessonCompletionRequirementsNotMetError) {
      expect(error.missing).toEqual([
        { lessonBlockId: reflection.id, blockType: "reflection", reason: "no response submitted" },
      ]);
    }

    await submitReflectionResponse(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonBlockId: reflection.id,
      text: "Feeling good",
    });
    const completed = await updateLessonProgress(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
      status: "completed",
    });
    expect(completed.status).toBe("completed");
  });

  it("blocks completing a lesson with an unlinked build activity", async () => {
    const admin = await registerAdmin("admin3@example.com");
    const learner = await registerLearner("learner3@example.com");
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
      slug: "goals",
      title: "Goals",
      outcome: "",
      orderIndex: 1,
    });
    const build = await createLessonBlock(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      orderIndex: 1,
      blockType: "build",
      payload: { instructions: "Create a goal.", targetAsset: "goal" },
    });
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
        status: "completed",
      }),
    ).rejects.toThrow(LessonCompletionRequirementsNotMetError);

    const goal = await createGoal(db, {
      workspaceId: learner.workspace.id,
      actorUserId: learner.user.id,
      title: "My goal",
      description: "",
    });
    await submitLessonApplication(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonBlockId: build.id,
      workspaceId: learner.workspace.id,
      resourceType: "goal",
      resourceId: goal.id,
      note: "",
    });

    const completed = await updateLessonProgress(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
      status: "completed",
    });
    expect(completed.status).toBe("completed");
  });

  it("allows completing a lesson made only of informational blocks with no evidence requirement", async () => {
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
    const lesson = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "goals",
      title: "Goals",
      outcome: "",
      orderIndex: 1,
    });
    await createLessonBlock(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      orderIndex: 1,
      blockType: "concept",
      payload: { explanation: "A goal is a measurable target." },
    });
    await createLessonBlock(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      orderIndex: 2,
      blockType: "celebration",
      payload: { message: "Nice work!" },
    });
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
    expect(completed.status).toBe("completed");
  });
});
