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
import {
  addBookmark,
  removeBookmark,
  listMyBookmarks,
  createNote,
  listNotesForLesson,
  updateNote,
  deleteNote,
} from "./notes-bookmarks-use-cases";
import { LessonNotFoundError, NoteNotFoundError } from "./errors";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("notes and bookmarks (Phase 3 fourth slice)", () => {
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

  async function setUpPublishedLesson(adminUserId: string) {
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
      title: "Goals",
      outcome: "",
      orderIndex: 1,
    });
    await updateLesson(db, { actorUserId: adminUserId, lessonId: lesson.id, status: "published" });
    await publishProgramVersion(db, {
      actorUserId: adminUserId,
      programId: program.id,
      programVersionId: version.id,
    });
    return lesson;
  }

  it("rejects bookmarking or noting a lesson that isn't visible (draft)", async () => {
    const admin = await registerAdmin("admin@example.com");
    const learner = await registerLearner("learner@example.com");
    const program = await createProgram(db, {
      actorUserId: admin.user.id,
      slug: "draft-program",
      title: "Draft",
      summary: "",
      orderIndex: 1,
    });
    const version = await createProgramVersion(db, {
      actorUserId: admin.user.id,
      programId: program.id,
      version: 1,
      outcomes: "",
    });
    const draftLesson = await createLesson(db, {
      actorUserId: admin.user.id,
      programVersionId: version.id,
      slug: "draft-lesson",
      title: "Draft lesson",
      outcome: "",
      orderIndex: 1,
    });

    await expect(
      addBookmark(db, { actorUserId: learner.user.id, lessonId: draftLesson.id }),
    ).rejects.toThrow(LessonNotFoundError);
    await expect(
      createNote(db, { actorUserId: learner.user.id, lessonId: draftLesson.id, content: "x" }),
    ).rejects.toThrow(LessonNotFoundError);
  });

  it("adds a bookmark, lists it, is idempotent on a second add, and can be removed", async () => {
    const admin = await registerAdmin("admin2@example.com");
    const learner = await registerLearner("learner2@example.com");
    const lesson = await setUpPublishedLesson(admin.user.id);

    const first = await addBookmark(db, { actorUserId: learner.user.id, lessonId: lesson.id });
    const second = await addBookmark(db, { actorUserId: learner.user.id, lessonId: lesson.id });
    expect(second.id).toBe(first.id);

    const bookmarks = await listMyBookmarks(db, { actorUserId: learner.user.id });
    expect(bookmarks.map((b) => b.id)).toEqual([first.id]);

    await removeBookmark(db, { actorUserId: learner.user.id, lessonId: lesson.id });
    const afterRemove = await listMyBookmarks(db, { actorUserId: learner.user.id });
    expect(afterRemove).toHaveLength(0);

    // Removing an already-removed bookmark is not an error.
    await expect(
      removeBookmark(db, { actorUserId: learner.user.id, lessonId: lesson.id }),
    ).resolves.toBeUndefined();
  });

  it("creates multiple notes on a lesson, lists them newest first, and updates one", async () => {
    const admin = await registerAdmin("admin3@example.com");
    const learner = await registerLearner("learner3@example.com");
    const lesson = await setUpPublishedLesson(admin.user.id);

    const first = await createNote(db, {
      actorUserId: learner.user.id,
      lessonId: lesson.id,
      content: "First thought",
    });
    const second = await createNote(db, {
      actorUserId: learner.user.id,
      lessonId: lesson.id,
      content: "Second thought",
    });

    const notes = await listNotesForLesson(db, {
      actorUserId: learner.user.id,
      lessonId: lesson.id,
    });
    expect(notes.map((n) => n.id)).toEqual([second.id, first.id]);

    const updated = await updateNote(db, {
      actorUserId: learner.user.id,
      noteId: first.id,
      content: "Revised first thought",
    });
    expect(updated.content).toBe("Revised first thought");
  });

  it("throws NoteNotFoundError updating or deleting a nonexistent note, and prevents touching another learner's note", async () => {
    const admin = await registerAdmin("admin4@example.com");
    const alice = await registerLearner("alice4@example.com");
    const bob = await registerLearner("bob4@example.com");
    const lesson = await setUpPublishedLesson(admin.user.id);

    await expect(
      updateNote(db, {
        actorUserId: alice.user.id,
        noteId: "00000000-0000-0000-0000-000000000000",
        content: "x",
      }),
    ).rejects.toThrow(NoteNotFoundError);
    await expect(
      deleteNote(db, {
        actorUserId: alice.user.id,
        noteId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(NoteNotFoundError);

    const alicesNote = await createNote(db, {
      actorUserId: alice.user.id,
      lessonId: lesson.id,
      content: "Alice's private note",
    });

    await expect(
      updateNote(db, { actorUserId: bob.user.id, noteId: alicesNote.id, content: "Hijacked" }),
    ).rejects.toThrow(NoteNotFoundError);
    await expect(
      deleteNote(db, { actorUserId: bob.user.id, noteId: alicesNote.id }),
    ).rejects.toThrow(NoteNotFoundError);

    // Bob never sees Alice's note in his own list for the same lesson.
    const bobsNotes = await listNotesForLesson(db, {
      actorUserId: bob.user.id,
      lessonId: lesson.id,
    });
    expect(bobsNotes).toHaveLength(0);

    // Alice can still delete her own note.
    await expect(
      deleteNote(db, { actorUserId: alice.user.id, noteId: alicesNote.id }),
    ).resolves.toBeUndefined();
  });
});
