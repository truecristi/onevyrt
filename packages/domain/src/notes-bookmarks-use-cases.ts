import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import { isUniqueViolation } from "./db-errors";
import { assertLessonVisible } from "./curriculum-use-cases";
import { NoteNotFoundError } from "./errors";

/**
 * PRD-CURRICULUM-004 vertical slice: notes and bookmarks. Personal, not
 * workspace-scoped - every function here scopes by the caller's own
 * userId, same shape as progress-use-cases.ts. A lesson must be visible
 * to the caller (assertLessonVisible) before it can be bookmarked or
 * noted - the same "don't leak which draft lesson IDs exist" rule
 * everywhere else in this curriculum applies here too.
 */

export interface BookmarkRecord {
  id: string;
  userId: string;
  lessonId: string;
  createdAt: Date;
}

export interface AddBookmarkInput {
  actorUserId: string;
  lessonId: string;
}

/** Idempotent on the happy path in spirit, but a second call for an already-bookmarked lesson still returns the existing row rather than erroring - a duplicate bookmark request is not a client bug worth surfacing. */
export async function addBookmark(db: Database, input: AddBookmarkInput): Promise<BookmarkRecord> {
  await assertLessonVisible(db, input.lessonId, input.actorUserId);

  try {
    const [bookmark] = await db
      .insert(schema.bookmarks)
      .values({ userId: input.actorUserId, lessonId: input.lessonId })
      .returning();
    if (!bookmark) throw new Error("Failed to create bookmark");
    return bookmark as BookmarkRecord;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await db.query.bookmarks.findFirst({
        where: and(
          eq(schema.bookmarks.userId, input.actorUserId),
          eq(schema.bookmarks.lessonId, input.lessonId),
        ),
      });
      if (existing) return existing as BookmarkRecord;
    }
    throw error;
  }
}

export interface RemoveBookmarkInput {
  actorUserId: string;
  lessonId: string;
}

/**
 * Deliberately idempotent, unlike every NotFoundError-throwing delete
 * elsewhere in this codebase: a bookmark is a toggle from the caller's
 * point of view, so "remove a bookmark that's already gone" is a normal
 * outcome of a double-click or a retried request, not an error.
 */
export async function removeBookmark(db: Database, input: RemoveBookmarkInput): Promise<void> {
  await db
    .delete(schema.bookmarks)
    .where(
      and(
        eq(schema.bookmarks.userId, input.actorUserId),
        eq(schema.bookmarks.lessonId, input.lessonId),
      ),
    );
}

export interface ListMyBookmarksInput {
  actorUserId: string;
}

export async function listMyBookmarks(
  db: Database,
  input: ListMyBookmarksInput,
): Promise<BookmarkRecord[]> {
  const rows = await db
    .select()
    .from(schema.bookmarks)
    .where(eq(schema.bookmarks.userId, input.actorUserId))
    .orderBy(desc(schema.bookmarks.createdAt));
  return rows as BookmarkRecord[];
}

export interface NoteRecord {
  id: string;
  userId: string;
  lessonId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNoteInput {
  actorUserId: string;
  lessonId: string;
  content: string;
}

export async function createNote(db: Database, input: CreateNoteInput): Promise<NoteRecord> {
  await assertLessonVisible(db, input.lessonId, input.actorUserId);

  const [note] = await db
    .insert(schema.notes)
    .values({ userId: input.actorUserId, lessonId: input.lessonId, content: input.content })
    .returning();
  if (!note) throw new Error("Failed to create note");
  return note as NoteRecord;
}

export interface ListNotesForLessonInput {
  actorUserId: string;
  lessonId: string;
}

/** Multiple notes per lesson, newest first - a running list, not a single field (see the doc comment on schema.ts's notes table). */
export async function listNotesForLesson(
  db: Database,
  input: ListNotesForLessonInput,
): Promise<NoteRecord[]> {
  const rows = await db
    .select()
    .from(schema.notes)
    .where(
      and(eq(schema.notes.userId, input.actorUserId), eq(schema.notes.lessonId, input.lessonId)),
    )
    .orderBy(desc(schema.notes.createdAt));
  return rows as NoteRecord[];
}

export interface UpdateNoteInput {
  actorUserId: string;
  noteId: string;
  content: string;
}

export async function updateNote(db: Database, input: UpdateNoteInput): Promise<NoteRecord> {
  const [note] = await db
    .update(schema.notes)
    .set({ content: input.content, updatedAt: new Date() })
    .where(and(eq(schema.notes.id, input.noteId), eq(schema.notes.userId, input.actorUserId)))
    .returning();
  if (!note) throw new NoteNotFoundError(input.noteId);
  return note as NoteRecord;
}

export interface DeleteNoteInput {
  actorUserId: string;
  noteId: string;
}

/**
 * Unlike removeBookmark, this throws NoteNotFoundError rather than
 * being silently idempotent: a note is a specific piece of content the
 * caller is asking to delete by ID, so deleting one that doesn't exist
 * (or isn't theirs) is worth surfacing as a client bug, not swallowing.
 */
export async function deleteNote(db: Database, input: DeleteNoteInput): Promise<void> {
  const [deleted] = await db
    .delete(schema.notes)
    .where(and(eq(schema.notes.id, input.noteId), eq(schema.notes.userId, input.actorUserId)))
    .returning({ id: schema.notes.id });
  if (!deleted) throw new NoteNotFoundError(input.noteId);
}
