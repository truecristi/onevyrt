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
import {
  submitKnowledgeCheckResponse,
  submitReflectionResponse,
  listBlockResponsesForLesson,
} from "./block-response-use-cases";
import { BlockTypeMismatchError, EnrollmentNotFoundError, LessonNotFoundError } from "./errors";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("knowledge-check and reflection responses (Phase 3 fifth slice)", () => {
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

  /** A published lesson with one knowledge-check block and one reflection block, ready to enroll in and respond to. */
  async function setUpPublishedLessonWithBlocks(adminUserId: string) {
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
    const knowledgeCheck = await createLessonBlock(db, {
      actorUserId: adminUserId,
      lessonId: lesson.id,
      orderIndex: 1,
      blockType: "knowledge-check",
      payload: {
        question: "What is a goal?",
        options: ["A measurable target", "A wish"],
        correctOptionIndex: 0,
      },
    });
    const reflection = await createLessonBlock(db, {
      actorUserId: adminUserId,
      lessonId: lesson.id,
      orderIndex: 2,
      blockType: "reflection",
      payload: { prompt: "How confident are you?" },
    });
    await updateLesson(db, { actorUserId: adminUserId, lessonId: lesson.id, status: "published" });
    await publishProgramVersion(db, {
      actorUserId: adminUserId,
      programId: program.id,
      programVersionId: version.id,
    });
    return { program, version, lesson, knowledgeCheck, reflection };
  }

  it("grades a knowledge-check response server-side, ignoring any client-supplied correctness", async () => {
    const admin = await registerAdmin("admin@example.com");
    const learner = await registerLearner("learner@example.com");
    const { version, knowledgeCheck } = await setUpPublishedLessonWithBlocks(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });

    const correct = await submitKnowledgeCheckResponse(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonBlockId: knowledgeCheck.id,
      selectedOptionIndex: 0,
    });
    expect(correct.response).toEqual({ selectedOptionIndex: 0, isCorrect: true });

    const incorrect = await submitKnowledgeCheckResponse(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonBlockId: knowledgeCheck.id,
      selectedOptionIndex: 1,
    });
    // Same response row (upsert), now graded incorrect - "current answer", not a log.
    expect(incorrect.id).toBe(correct.id);
    expect(incorrect.response).toEqual({ selectedOptionIndex: 1, isCorrect: false });
  });

  it("records a reflection response with and without a confidence rating", async () => {
    const admin = await registerAdmin("admin2@example.com");
    const learner = await registerLearner("learner2@example.com");
    const { version, reflection } = await setUpPublishedLessonWithBlocks(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });

    const withRating = await submitReflectionResponse(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonBlockId: reflection.id,
      text: "I feel confident about this",
      confidenceRating: 4,
    });
    expect(withRating.response).toEqual({
      text: "I feel confident about this",
      confidenceRating: 4,
    });

    const withoutRating = await submitReflectionResponse(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonBlockId: reflection.id,
      text: "Actually, revised thought",
    });
    expect(withoutRating.response).toEqual({ text: "Actually, revised thought" });
  });

  it("rejects submitting a knowledge-check response to a reflection block and vice versa", async () => {
    const admin = await registerAdmin("admin3@example.com");
    const learner = await registerLearner("learner3@example.com");
    const { version, knowledgeCheck, reflection } = await setUpPublishedLessonWithBlocks(
      admin.user.id,
    );
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });

    await expect(
      submitReflectionResponse(db, {
        actorUserId: learner.user.id,
        enrollmentId: enrollment.id,
        lessonBlockId: knowledgeCheck.id,
        text: "Wrong block type",
      }),
    ).rejects.toThrow(BlockTypeMismatchError);

    await expect(
      submitKnowledgeCheckResponse(db, {
        actorUserId: learner.user.id,
        enrollmentId: enrollment.id,
        lessonBlockId: reflection.id,
        selectedOptionIndex: 0,
      }),
    ).rejects.toThrow(BlockTypeMismatchError);
  });

  it("lists both responses for a lesson and prevents another learner from touching them", async () => {
    const admin = await registerAdmin("admin4@example.com");
    const alice = await registerLearner("alice4@example.com");
    const bob = await registerLearner("bob4@example.com");
    const { version, lesson, knowledgeCheck, reflection } = await setUpPublishedLessonWithBlocks(
      admin.user.id,
    );
    const aliceEnrollment = await enroll(db, {
      actorUserId: alice.user.id,
      programVersionId: version.id,
    });

    await submitKnowledgeCheckResponse(db, {
      actorUserId: alice.user.id,
      enrollmentId: aliceEnrollment.id,
      lessonBlockId: knowledgeCheck.id,
      selectedOptionIndex: 0,
    });
    await submitReflectionResponse(db, {
      actorUserId: alice.user.id,
      enrollmentId: aliceEnrollment.id,
      lessonBlockId: reflection.id,
      text: "Feeling good",
    });

    const aliceResponses = await listBlockResponsesForLesson(db, {
      actorUserId: alice.user.id,
      enrollmentId: aliceEnrollment.id,
      lessonId: lesson.id,
    });
    expect(aliceResponses).toHaveLength(2);

    await expect(
      submitKnowledgeCheckResponse(db, {
        actorUserId: bob.user.id,
        enrollmentId: aliceEnrollment.id,
        lessonBlockId: knowledgeCheck.id,
        selectedOptionIndex: 0,
      }),
    ).rejects.toThrow(EnrollmentNotFoundError);

    await expect(
      listBlockResponsesForLesson(db, {
        actorUserId: bob.user.id,
        enrollmentId: aliceEnrollment.id,
        lessonId: lesson.id,
      }),
    ).rejects.toThrow(EnrollmentNotFoundError);
  });

  it("rejects a response to a block outside the enrolled program version", async () => {
    const admin = await registerAdmin("admin5@example.com");
    const learner = await registerLearner("learner5@example.com");
    const { version } = await setUpPublishedLessonWithBlocks(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });

    const { knowledgeCheck: otherBlock } = await setUpPublishedLessonWithBlocks(admin.user.id);

    await expect(
      submitKnowledgeCheckResponse(db, {
        actorUserId: learner.user.id,
        enrollmentId: enrollment.id,
        lessonBlockId: otherBlock.id,
        selectedOptionIndex: 0,
      }),
    ).rejects.toThrow(LessonNotFoundError);
  });
});
