import { eq } from "drizzle-orm";
import { createDatabase, schema } from "@onevyrt/database";
import {
  registerUser,
  createProgram,
  updateProgram,
  createProgramVersion,
  createLesson,
  updateLesson,
  createLessonBlock,
  publishProgramVersion,
} from "@onevyrt/domain";

/**
 * Phase 9 Learn slice: a standalone script (run via `tsx`, not imported
 * directly into a Playwright test module) that seeds one published
 * program+lesson for tests/e2e/learn.spec.ts.
 *
 * Why a separate process rather than importing @onevyrt/domain straight
 * into the spec file: @onevyrt/database's index.ts re-exports migrate.ts,
 * which uses `import.meta.url` - real ESM. Playwright's own TS transform
 * targets CommonJS and chokes on that ("exports is not defined in ES
 * module scope") the moment anything in the import graph reaches it, and
 * @onevyrt/domain's own source files import @onevyrt/database's full
 * barrel throughout, so there's no submodule-path workaround from inside
 * the spec file itself. `tsx` (already this repo's own migration
 * runner - see package.json's db:migrate script) handles real ESM fine,
 * so seeding runs here instead and the spec just shells out to it.
 *
 * There's no UI path to become a platform admin or publish curriculum
 * content, and there shouldn't be one built just for a test - this
 * mirrors packages/domain/src/curriculum-authorization.test.ts's own
 * pattern: register a user, flip isPlatformAdmin directly via a DB
 * update, then call the curriculum domain functions directly (not
 * through HTTP).
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgres://postgres:onevyrt@127.0.0.1:5432/onevyrt_test";

// Only used to hash a session token for the seeded admin - that session
// is never used from the browser, so its value doesn't need to match the
// server's real AUTH_SECRET.
const SEED_AUTH_SECRET = "b".repeat(64);

const programTitle = process.env.SEED_PROGRAM_TITLE;
const lessonTitle = process.env.SEED_LESSON_TITLE;
if (!programTitle || !lessonTitle) {
  throw new Error("SEED_PROGRAM_TITLE and SEED_LESSON_TITLE env vars are required");
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function main() {
  const { db, pool } = createDatabase(TEST_DATABASE_URL);
  try {
    const admin = await registerUser(db, SEED_AUTH_SECRET, {
      email: `${unique("e2e-learn-admin")}@example.test`,
      password: "a-genuinely-long-password-123",
      workspaceName: "Admin Workspace",
    });
    await db
      .update(schema.users)
      .set({ isPlatformAdmin: true })
      .where(eq(schema.users.id, admin.user.id));

    const program = await createProgram(db, {
      actorUserId: admin.user.id,
      slug: unique("e2e-program"),
      title: programTitle,
      summary: "A program seeded directly by learn.spec.ts, not through the UI.",
      orderIndex: 0,
    });
    // A program's own status (draft by default) is independent of its
    // versions' status - listPrograms only shows non-admins "published"
    // programs, so both need publishing, not just the version.
    await updateProgram(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      status: "published",
    });
    const version = await createProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      version: 1,
      outcomes: "Learn how the Learn destination's browse-enroll-learn loop works.",
    });
    const lesson = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: unique("e2e-lesson"),
      title: lessonTitle,
      outcome: "Understand a knowledge check and a reflection.",
      orderIndex: 0,
    });
    await createLessonBlock(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      orderIndex: 0,
      blockType: "concept",
      payload: { explanation: "This is a read-only concept block." },
    });
    await createLessonBlock(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      orderIndex: 1,
      blockType: "knowledge-check",
      payload: {
        question: "What is 2 + 2?",
        options: ["3", "4", "5"],
        correctOptionIndex: 1,
        explanation: "2 + 2 is 4.",
      },
    });
    await createLessonBlock(db, {
      actorUserId: admin.user.id,
      lessonId: lesson.id,
      orderIndex: 2,
      blockType: "reflection",
      payload: { prompt: "What did you learn?", collectConfidenceRating: false },
    });
    // A lesson's own status (draft by default) is independent of its
    // parent program version's status too, same as the program/version
    // split above - listLessons only shows non-admins a lesson that is
    // itself "published" inside a "published" version. Must happen while
    // the version is still "draft" - updateLesson requires that
    // (assertProgramVersionEditable), so this comes before
    // publishProgramVersion below, which freezes it.
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
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
