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
import { createGoal } from "./business-core-use-cases";
import {
  submitLessonApplication,
  listLessonApplicationsForEnrollment,
} from "./lesson-application-use-cases";
import {
  BlockTypeMismatchError,
  LessonApplicationResourceNotFoundError,
  EnrollmentNotFoundError,
} from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("lesson application (Phase 3 seventh slice)", () => {
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

  /** A published lesson with one "build" block and one "concept" block. */
  async function setUpPublishedLessonWithBuildBlock(adminUserId: string) {
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
      slug: "goals",
      title: "Set your first goal",
      outcome: "",
      orderIndex: 1,
    });
    const buildBlock = await createLessonBlock(db, {
      actorUserId: adminUserId,
      lessonId: lesson.id,
      orderIndex: 1,
      blockType: "build",
      payload: { instructions: "Create a goal in your business.", targetAsset: "goal" },
    });
    const conceptBlock = await createLessonBlock(db, {
      actorUserId: adminUserId,
      lessonId: lesson.id,
      orderIndex: 2,
      blockType: "concept",
      payload: { explanation: "A goal is a measurable target." },
    });
    await updateLesson(db, { actorUserId: adminUserId, lessonId: lesson.id, status: "published" });
    await publishProgramVersion(db, {
      actorUserId: adminUserId,
      programId: program.id,
      programVersionId: version.id,
    });
    return { program, version, lesson, buildBlock, conceptBlock };
  }

  it("links a build block to a real goal the learner created in their own workspace", async () => {
    const admin = await registerAdmin("admin@example.com");
    const learner = await registerLearner("learner@example.com");
    const { version, buildBlock } = await setUpPublishedLessonWithBuildBlock(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });

    const goal = await createGoal(db, {
      workspaceId: learner.workspace.id,
      actorUserId: learner.user.id,
      title: "Reach $10k MRR",
      description: "",
    });

    const application = await submitLessonApplication(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonBlockId: buildBlock.id,
      workspaceId: learner.workspace.id,
      resourceType: "goal",
      resourceId: goal.id,
      note: "This is my first goal",
    });
    expect(application.resourceType).toBe("goal");
    expect(application.resourceId).toBe(goal.id);

    const list = await listLessonApplicationsForEnrollment(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
    });
    expect(list.map((a) => a.id)).toEqual([application.id]);
  });

  it("resubmitting overwrites the current application rather than logging a new one", async () => {
    const admin = await registerAdmin("admin2@example.com");
    const learner = await registerLearner("learner2@example.com");
    const { version, buildBlock } = await setUpPublishedLessonWithBuildBlock(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });
    const goalA = await createGoal(db, {
      workspaceId: learner.workspace.id,
      actorUserId: learner.user.id,
      title: "Goal A",
      description: "",
    });
    const goalB = await createGoal(db, {
      workspaceId: learner.workspace.id,
      actorUserId: learner.user.id,
      title: "Goal B",
      description: "",
    });

    const first = await submitLessonApplication(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonBlockId: buildBlock.id,
      workspaceId: learner.workspace.id,
      resourceType: "goal",
      resourceId: goalA.id,
      note: "",
    });
    const second = await submitLessonApplication(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
      lessonBlockId: buildBlock.id,
      workspaceId: learner.workspace.id,
      resourceType: "goal",
      resourceId: goalB.id,
      note: "Changed my mind",
    });
    expect(second.id).toBe(first.id);
    expect(second.resourceId).toBe(goalB.id);

    const list = await listLessonApplicationsForEnrollment(db, {
      actorUserId: learner.user.id,
      enrollmentId: enrollment.id,
    });
    expect(list).toHaveLength(1);
  });

  it("rejects submitting an application against a non-build block type", async () => {
    const admin = await registerAdmin("admin3@example.com");
    const learner = await registerLearner("learner3@example.com");
    const { version, conceptBlock } = await setUpPublishedLessonWithBuildBlock(admin.user.id);
    const enrollment = await enroll(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });
    const goal = await createGoal(db, {
      workspaceId: learner.workspace.id,
      actorUserId: learner.user.id,
      title: "Goal",
      description: "",
    });

    await expect(
      submitLessonApplication(db, {
        actorUserId: learner.user.id,
        enrollmentId: enrollment.id,
        lessonBlockId: conceptBlock.id,
        workspaceId: learner.workspace.id,
        resourceType: "goal",
        resourceId: goal.id,
        note: "",
      }),
    ).rejects.toThrow(BlockTypeMismatchError);
  });

  it("rejects a workspace the learner doesn't belong to, and a resource that doesn't exist in the given workspace", async () => {
    const admin = await registerAdmin("admin4@example.com");
    const alice = await registerLearner("alice4@example.com");
    const bob = await registerLearner("bob4@example.com");
    const { version, buildBlock } = await setUpPublishedLessonWithBuildBlock(admin.user.id);
    const aliceEnrollment = await enroll(db, {
      actorUserId: alice.user.id,
      programVersionId: version.id,
    });

    const bobsGoal = await createGoal(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      title: "Bob's goal",
      description: "",
    });

    // Alice tries to submit against Bob's workspace - she isn't a member.
    await expect(
      submitLessonApplication(db, {
        actorUserId: alice.user.id,
        enrollmentId: aliceEnrollment.id,
        lessonBlockId: buildBlock.id,
        workspaceId: bob.workspace.id,
        resourceType: "goal",
        resourceId: bobsGoal.id,
        note: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    // A resourceId that doesn't exist in Alice's own workspace.
    await expect(
      submitLessonApplication(db, {
        actorUserId: alice.user.id,
        enrollmentId: aliceEnrollment.id,
        lessonBlockId: buildBlock.id,
        workspaceId: alice.workspace.id,
        resourceType: "goal",
        resourceId: bobsGoal.id,
        note: "",
      }),
    ).rejects.toThrow(LessonApplicationResourceNotFoundError);
  });

  it("prevents one learner from touching another learner's applications", async () => {
    const admin = await registerAdmin("admin5@example.com");
    const alice = await registerLearner("alice5@example.com");
    const bob = await registerLearner("bob5@example.com");
    const { version, buildBlock } = await setUpPublishedLessonWithBuildBlock(admin.user.id);
    const aliceEnrollment = await enroll(db, {
      actorUserId: alice.user.id,
      programVersionId: version.id,
    });
    const goal = await createGoal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Alice's goal",
      description: "",
    });
    await submitLessonApplication(db, {
      actorUserId: alice.user.id,
      enrollmentId: aliceEnrollment.id,
      lessonBlockId: buildBlock.id,
      workspaceId: alice.workspace.id,
      resourceType: "goal",
      resourceId: goal.id,
      note: "",
    });

    await expect(
      submitLessonApplication(db, {
        actorUserId: bob.user.id,
        enrollmentId: aliceEnrollment.id,
        lessonBlockId: buildBlock.id,
        workspaceId: alice.workspace.id,
        resourceType: "goal",
        resourceId: goal.id,
        note: "",
      }),
    ).rejects.toThrow(EnrollmentNotFoundError);

    await expect(
      listLessonApplicationsForEnrollment(db, {
        actorUserId: bob.user.id,
        enrollmentId: aliceEnrollment.id,
      }),
    ).rejects.toThrow(EnrollmentNotFoundError);
  });
});
