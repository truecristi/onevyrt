import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, schema, type Database } from "@onevyrt/database";
import { eq } from "drizzle-orm";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import {
  createProgram,
  listPrograms,
  updateProgram,
  createProgramVersion,
  listProgramVersions,
  publishProgramVersion,
  createLesson,
  listLessons,
  updateLesson,
} from "./curriculum-use-cases";
import {
  ProgramNotFoundError,
  DuplicateProgramSlugError,
  ProgramVersionNotFoundError,
  DuplicateProgramVersionError,
  ProgramVersionNotEditableError,
  LessonNotFoundError,
  DuplicateLessonSlugError,
} from "./errors";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("curriculum: programs, versions and lessons (Phase 3 first slice)", () => {
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

  it("rejects program creation from a non-admin", async () => {
    const learner = await registerLearner("learner@example.com");
    await expect(
      createProgram(db, {
        actorUserId: learner.user.id,
        slug: "orientation",
        title: "Orientation",
        summary: "",
        orderIndex: 1,
      }),
    ).rejects.toThrow(PlatformAdminRequiredError);
  });

  it("lets an admin create a program and hides non-published programs from a learner", async () => {
    const admin = await registerAdmin("admin@example.com");
    const learner = await registerLearner("learner2@example.com");

    const program = await createProgram(db, {
      actorUserId: admin.user.id,
      slug: "orientation",
      title: "Orientation and Owner Truth",
      summary: "",
      orderIndex: 1,
    });
    expect(program.status).toBe("draft");

    const learnerView = await listPrograms(db, { actorUserId: learner.user.id });
    expect(learnerView).toHaveLength(0);

    const adminView = await listPrograms(db, { actorUserId: admin.user.id });
    expect(adminView.map((p) => p.id)).toEqual([program.id]);

    await updateProgram(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      status: "published",
    });

    const learnerViewAfterPublish = await listPrograms(db, { actorUserId: learner.user.id });
    expect(learnerViewAfterPublish.map((p) => p.id)).toEqual([program.id]);
  });

  it("rejects a duplicate program slug", async () => {
    const admin = await registerAdmin("admin2@example.com");
    await createProgram(db, {
      actorUserId: admin.user.id,
      slug: "orientation",
      title: "Orientation",
      summary: "",
      orderIndex: 1,
    });

    await expect(
      createProgram(db, {
        actorUserId: admin.user.id,
        slug: "orientation",
        title: "Orientation Again",
        summary: "",
        orderIndex: 2,
      }),
    ).rejects.toThrow(DuplicateProgramSlugError);
  });

  it("throws ProgramNotFoundError updating a program that doesn't exist", async () => {
    const admin = await registerAdmin("admin3@example.com");
    await expect(
      updateProgram(db, {
        actorUserId: admin.user.id,
        programId: "00000000-0000-0000-0000-000000000000",
        title: "Should fail",
      }),
    ).rejects.toThrow(ProgramNotFoundError);
  });

  it("publishing a version archives the previously-published version, and rejects a duplicate version number", async () => {
    const admin = await registerAdmin("admin4@example.com");
    const learner = await registerLearner("learner4@example.com");
    const program = await createProgram(db, {
      actorUserId: admin.user.id,
      slug: "orientation",
      title: "Orientation",
      summary: "",
      orderIndex: 1,
    });

    const v1 = await createProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      version: 1,
      outcomes: "Understand your starting point",
    });

    await expect(
      createProgramVersion(db, {
        actorUserId: admin.user.id,
        programId: program.id,
        version: 1,
        outcomes: "duplicate",
      }),
    ).rejects.toThrow(DuplicateProgramVersionError);

    const publishedV1 = await publishProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      programVersionId: v1.id,
    });
    expect(publishedV1.status).toBe("published");
    expect(publishedV1.publishedAt).not.toBeNull();

    // A learner sees the published version.
    const learnerVersions = await listProgramVersions(db, {
      actorUserId: learner.user.id,
      programId: program.id,
    });
    expect(learnerVersions.map((v) => v.id)).toEqual([v1.id]);

    const v2 = await createProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      version: 2,
      outcomes: "Revised outcomes",
    });
    const publishedV2 = await publishProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      programVersionId: v2.id,
    });
    expect(publishedV2.status).toBe("published");

    const versionsAfter = await listProgramVersions(db, {
      actorUserId: admin.user.id,
      programId: program.id,
    });
    const v1After = versionsAfter.find((v) => v.id === v1.id);
    expect(v1After?.status).toBe("archived");

    // The learner now only sees v2 as published.
    const learnerVersionsAfter = await listProgramVersions(db, {
      actorUserId: learner.user.id,
      programId: program.id,
    });
    expect(learnerVersionsAfter.map((v) => v.id)).toEqual([v2.id]);
  });

  it("creates lessons on a draft version, blocks edits once published, and hides draft lessons from learners", async () => {
    const admin = await registerAdmin("admin5@example.com");
    const learner = await registerLearner("learner5@example.com");
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

    const publishedLesson = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "goals-and-baseline",
      title: "Goals and baseline",
      outcome: "State your business goals and current baseline",
      orderIndex: 1,
    });
    await updateLesson(db, {
      actorUserId: admin.user.id,
      lessonId: publishedLesson.id,
      status: "published",
    });

    const draftLesson = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "bonus-lesson",
      title: "Bonus lesson (not ready)",
      outcome: "",
      orderIndex: 2,
    });
    expect(draftLesson.status).toBe("draft");

    await expect(
      createLesson(db, {
        actorUserId: admin.user.id,
        programVersionId: version.id,
        slug: "goals-and-baseline",
        title: "Duplicate slug",
        outcome: "",
        orderIndex: 3,
      }),
    ).rejects.toThrow(DuplicateLessonSlugError);

    await publishProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      programVersionId: version.id,
    });

    // Editing is now blocked - the version is frozen.
    await expect(
      updateLesson(db, {
        actorUserId: admin.user.id,
        lessonId: draftLesson.id,
        status: "published",
      }),
    ).rejects.toThrow(ProgramVersionNotEditableError);
    await expect(
      createLesson(db, {
        actorUserId: admin.user.id,
        programVersionId: version.id,
        slug: "too-late",
        title: "Too late",
        outcome: "",
        orderIndex: 4,
      }),
    ).rejects.toThrow(ProgramVersionNotEditableError);

    // The learner sees only the published lesson, not the still-draft one.
    const learnerLessons = await listLessons(db, {
      actorUserId: learner.user.id,
      programVersionId: version.id,
    });
    expect(learnerLessons.map((l) => l.id)).toEqual([publishedLesson.id]);

    // The admin still sees both.
    const adminLessons = await listLessons(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
    });
    expect(adminLessons.map((l) => l.id).sort()).toEqual(
      [publishedLesson.id, draftLesson.id].sort(),
    );
  });

  it("throws ProgramVersionNotFoundError rather than exposing a draft version's lessons to a learner", async () => {
    const admin = await registerAdmin("admin6@example.com");
    const learner = await registerLearner("learner6@example.com");
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
      listLessons(db, { actorUserId: learner.user.id, programVersionId: version.id }),
    ).rejects.toThrow(ProgramVersionNotFoundError);
  });

  it("throws LessonNotFoundError updating a lesson that doesn't exist", async () => {
    const admin = await registerAdmin("admin7@example.com");
    await expect(
      updateLesson(db, {
        actorUserId: admin.user.id,
        lessonId: "00000000-0000-0000-0000-000000000000",
        title: "Should fail",
      }),
    ).rejects.toThrow(LessonNotFoundError);
  });
});
