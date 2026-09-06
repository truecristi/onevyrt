/**
 * Curriculum storage: the admin-editable programme content (stages,
 * lessons, assignments) — instance-wide, not per-workspace, the same way
 * lib/settings.ts is instance-wide. One JSON file holding every programme
 * by id, seeded with a default on first read so there's always something
 * to enroll a learner into without a separate "set up your first
 * programme" step.
 *
 * Real no-code editing now exists (mutations below), so this is no longer
 * always-overwrite-from-code. Instead: the first read seeds from
 * curriculum-seed.ts, and every read after that additively merges in any
 * NEW stage/lesson ids curriculum-seed.ts gains later (so a code update
 * still reaches a running instance without a migration step) while never
 * touching a stage/lesson id that already exists in storage — an admin's
 * edits win. A deliberately deleted stage/lesson is tracked in a small
 * tombstone file (curriculum-deletions.json) so the merge doesn't
 * resurrect it just because its id still exists in curriculum-seed.ts —
 * without this, "delete" wouldn't actually stick, which would undermine
 * the entire point of no-code editing. Safe either way with respect to
 * learner progress: enrollments.ts only ever references lesson ids by
 * string.
 */
import { randomBytes } from "node:crypto";
import { pgPool, withAdvisoryLock, type Queryable } from "./db";
import type { ProgrammeTemplate, StageTemplate, LessonTemplate, AssignmentTemplate } from "@onevyrt/engine";
import { reconcileToChapters, isCanonical } from "@onevyrt/engine";
import { DEFAULT_PROGRAMME } from "./curriculum-seed";

type CurriculumStore = Record<string, ProgrammeTemplate>;
interface Tombstones { stageIds: string[]; lessonIds: string[]; }
type TombstoneStore = Record<string, Tombstones>; // programmeId -> tombstones

// The stable string every mutation takes a cross-container advisory lock on (see
// db.ts withAdvisoryLock). A delete records its tombstone on this same lock's
// client, in the same transaction as the programme write (see mutate /
// recordTombstone), so the delete and its tombstone commit atomically — a
// concurrent read can't slip between them and resurrect a just-deleted seed
// stage/lesson. curriculum_deletions is written nowhere else, so this one lock
// fully serializes it against every reader (readOrSeedDefault) and writer.
const CURRICULUM_LOCK_KEY = "curriculum";

// Same shape as users/workspaces/cohorts: every function does full read/
// mutate/write under one cross-container advisory lock (mostly through the
// shared `mutate` helper below).
// `db` defaults to the shared pool for the lock-free read path (getProgramme),
// but every mutation passes in its advisory-lock client so the whole
// read/merge/write runs on ONE connection inside the lock's transaction —
// checking out a second connection while holding the lock connection is a
// pool-starvation deadlock (see db.ts withAdvisoryLock). The write helpers
// therefore issue no BEGIN/COMMIT of their own: the surrounding lock already
// provides the transaction, and doing so here also keeps the table-replace
// atomic with the lock rather than committing early and dropping the lock.
async function readAll(db: Queryable = pgPool()): Promise<CurriculumStore> {
  const res = await db.query<{ id: string; programme: ProgrammeTemplate }>("SELECT id, programme FROM curriculum");
  const store: CurriculumStore = {};
  for (const row of res.rows) store[row.id] = row.programme;
  return store;
}
async function writeAll(store: CurriculumStore, db: Queryable): Promise<void> {
  const entries = Object.entries(store);
  if (entries.length === 0) await db.query("DELETE FROM curriculum");
  else await db.query("DELETE FROM curriculum WHERE id <> ALL($1::text[])", [entries.map(([id]) => id)]);
  for (const [id, programme] of entries) {
    await db.query(
      "INSERT INTO curriculum (id, programme) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET programme = EXCLUDED.programme",
      [id, JSON.stringify(programme)],
    );
  }
}
async function readTombstones(db: Queryable = pgPool()): Promise<TombstoneStore> {
  const res = await db.query<{ programme_id: string; stage_ids: string[]; lesson_ids: string[] }>("SELECT * FROM curriculum_deletions");
  const store: TombstoneStore = {};
  for (const row of res.rows) store[row.programme_id] = { stageIds: row.stage_ids, lessonIds: row.lesson_ids };
  return store;
}
async function writeTombstones(store: TombstoneStore, db: Queryable): Promise<void> {
  const entries = Object.entries(store);
  if (entries.length === 0) await db.query("DELETE FROM curriculum_deletions");
  else await db.query("DELETE FROM curriculum_deletions WHERE programme_id <> ALL($1::text[])", [entries.map(([id]) => id)]);
  for (const [id, t] of entries) {
    await db.query(
      `INSERT INTO curriculum_deletions (programme_id, stage_ids, lesson_ids) VALUES ($1, $2, $3)
       ON CONFLICT (programme_id) DO UPDATE SET stage_ids = EXCLUDED.stage_ids, lesson_ids = EXCLUDED.lesson_ids`,
      [id, JSON.stringify(t.stageIds), JSON.stringify(t.lessonIds)],
    );
  }
}
/** Records that a stage/lesson id was deliberately deleted. Runs on the
 *  caller's already-locked curriculum client (never a fresh connection or a
 *  second advisory lock) so the tombstone write joins the SAME transaction as
 *  the programme delete that triggered it — see mutate. That shared transaction
 *  is what makes delete+tombstone atomic; the surrounding CURRICULUM_LOCK
 *  already serializes this table against every other reader and writer, so no
 *  separate tombstones lock is needed (and taking one here would be the second
 *  connection-under-lock pool-starvation hazard db.ts warns about). */
async function recordTombstone(db: Queryable, programmeId: string, kind: "stageIds" | "lessonIds", id: string): Promise<void> {
  const store = await readTombstones(db);
  const cur = store[programmeId] ?? { stageIds: [], lessonIds: [] };
  if (!cur[kind].includes(id)) cur[kind].push(id);
  store[programmeId] = cur;
  await writeTombstones(store, db);
}

function mergeNewSeedContent(stored: ProgrammeTemplate, deleted: Tombstones): ProgrammeTemplate {
  const merged: ProgrammeTemplate = structuredClone(stored);
  for (const seedStage of DEFAULT_PROGRAMME.stages) {
    if (deleted.stageIds.includes(seedStage.id)) continue;
    const stage = merged.stages.find((s) => s.id === seedStage.id);
    if (!stage) { merged.stages.push(structuredClone(seedStage)); continue; }
    for (const seedLesson of seedStage.lessons) {
      if (deleted.lessonIds.includes(seedLesson.id)) continue;
      if (!stage.lessons.some((l) => l.id === seedLesson.id)) stage.lessons.push(structuredClone(seedLesson));
    }
  }
  return merged;
}

async function readOrSeedDefault(db: Queryable): Promise<{ store: CurriculumStore; programme: ProgrammeTemplate; storedRaw: ProgrammeTemplate | undefined }> {
  const store = await readAll(db);
  const storedRaw = store[DEFAULT_PROGRAMME.id];
  const tombstones = await readTombstones(db);
  const deleted = tombstones[DEFAULT_PROGRAMME.id] ?? { stageIds: [], lessonIds: [] };
  // Defensive canonicalization: a stored blob from before the three-chapter arc
  // is reshaped IN MEMORY (the one-time migration normally already did this in
  // the DB) so the additive seed-merge compares canonical-with-canonical and can
  // never duplicate a lesson. Reads never PERSIST this on their own — the write
  // decision lives in getDefaultProgramme (only on a real change), and the
  // migration owns the durable reshape.
  const base = storedRaw ? (isCanonical(storedRaw) ? storedRaw : reconcileToChapters(storedRaw)) : DEFAULT_PROGRAMME;
  const programme = mergeNewSeedContent(base, deleted);
  return { store, programme, storedRaw };
}

export async function getDefaultProgramme(): Promise<ProgrammeTemplate> {
  return withAdvisoryLock(CURRICULUM_LOCK_KEY, async (db) => {
    const { store, programme, storedRaw } = await readOrSeedDefault(db);
    // Persist only when something actually changed — a first-time seed, newly
    // merged seed content, or a one-time canonical upgrade. Steady-state reads
    // no longer rewrite the singleton row on every call (the old mutate-on-read).
    if (storedRaw === undefined || JSON.stringify(storedRaw) !== JSON.stringify(programme)) {
      store[programme.id] = programme;
      await writeAll(store, db);
    }
    return programme;
  });
}

export async function getProgramme(id: string): Promise<ProgrammeTemplate | null> {
  if (id === DEFAULT_PROGRAMME.id) return getDefaultProgramme();
  const store = await readAll();
  return store[id] ?? null;
}

const MAX_TEXT = 20_000;
const MAX_STAGES = 50;
const MAX_LESSONS_PER_STAGE = 50;

async function mutate(
  fn: (p: ProgrammeTemplate) => void | { error: string },
  tombstone?: { kind: "stageIds" | "lessonIds"; id: string },
): Promise<ProgrammeTemplate | { error: string }> {
  return withAdvisoryLock(CURRICULUM_LOCK_KEY, async (db) => {
    const { store, programme } = await readOrSeedDefault(db);
    const result = fn(programme);
    if (result && "error" in result) return result;
    programme.updatedAt = new Date().toISOString();
    store[programme.id] = programme;
    await writeAll(store, db);
    // A delete passes the id to tombstone; record it HERE — same locked client,
    // same transaction as the write above — so the programme-delete and the
    // tombstone commit together (or roll back together). This closes the
    // resurrection race the old two-step left open: previously mutate committed
    // and released the lock, THEN a separate lock wrote the tombstone, and a
    // getDefaultProgramme in that gap would read the post-delete programme
    // against the pre-tombstone deletions and re-merge the seed stage/lesson
    // right back in.
    if (tombstone) await recordTombstone(db, programme.id, tombstone.kind, tombstone.id);
    return programme;
  });
}

function nextOrder(items: { order: number }[]): number {
  return items.length === 0 ? 0 : Math.max(...items.map((i) => i.order)) + 1;
}

/** Shared by moveStage/moveLesson: swaps `order` with whichever neighbour
 *  is one step in `direction` within the already order-sorted list.
 *  No-op past either end. Mutates the matched items in place. */
function swapOrder<T extends { id: string; order: number }>(sorted: T[], id: string, direction: "up" | "down"): "not_found" | "ok" {
  const idx = sorted.findIndex((item) => item.id === id);
  if (idx === -1) return "not_found";
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= sorted.length) return "ok";
  const a = sorted[idx]!, b = sorted[swapWith]!;
  const tmp = a.order; a.order = b.order; b.order = tmp;
  return "ok";
}

export async function addStage(title: string, outcome: string): Promise<ProgrammeTemplate | { error: string }> {
  const cleanTitle = title.trim().slice(0, 200);
  if (!cleanTitle) return { error: "A stage needs a title." };
  return mutate((p) => {
    if (p.stages.length >= MAX_STAGES) return { error: "Too many stages already." };
    const stage: StageTemplate = { id: randomBytes(6).toString("hex"), order: nextOrder(p.stages), title: cleanTitle, outcome: outcome.trim().slice(0, MAX_TEXT), lessons: [] };
    p.stages.push(stage);
  });
}

export async function updateStage(stageId: string, patch: { title?: string; outcome?: string }): Promise<ProgrammeTemplate | { error: string }> {
  return mutate((p) => {
    const stage = p.stages.find((s) => s.id === stageId);
    if (!stage) return { error: "Stage not found." };
    if (patch.title !== undefined) { const t = patch.title.trim().slice(0, 200); if (!t) return { error: "A stage needs a title." }; stage.title = t; }
    if (patch.outcome !== undefined) stage.outcome = patch.outcome.trim().slice(0, MAX_TEXT);
  });
}

export async function deleteStage(stageId: string): Promise<ProgrammeTemplate | { error: string }> {
  // The tombstone descriptor rides into mutate so the splice and the tombstone
  // land in one transaction under one lock (see mutate) — atomic delete.
  return mutate((p) => {
    const idx = p.stages.findIndex((s) => s.id === stageId);
    if (idx === -1) return { error: "Stage not found." };
    p.stages.splice(idx, 1);
  }, { kind: "stageIds", id: stageId });
}

export async function moveStage(stageId: string, direction: "up" | "down"): Promise<ProgrammeTemplate | { error: string }> {
  return mutate((p) => {
    const ordered = [...p.stages].sort((a, b) => a.order - b.order);
    if (swapOrder(ordered, stageId, direction) === "not_found") return { error: "Stage not found." };
  });
}

export async function addLesson(stageId: string, title: string, outcome: string): Promise<ProgrammeTemplate | { error: string }> {
  const cleanTitle = title.trim().slice(0, 200);
  if (!cleanTitle) return { error: "A lesson needs a title." };
  return mutate((p) => {
    const stage = p.stages.find((s) => s.id === stageId);
    if (!stage) return { error: "Stage not found." };
    if (stage.lessons.length >= MAX_LESSONS_PER_STAGE) return { error: "Too many lessons in this stage already." };
    const lesson: LessonTemplate = { id: randomBytes(6).toString("hex"), order: nextOrder(stage.lessons), title: cleanTitle, outcome: outcome.trim().slice(0, MAX_TEXT), content: "" };
    stage.lessons.push(lesson);
  });
}

export interface LessonPatch {
  title?: string; outcome?: string; content?: string; videoUrl?: string; resourceUrls?: string[];
  toolDeepLink?: string; estimatedMinutes?: number; assignment?: AssignmentTemplate | null;
}
export async function updateLesson(lessonId: string, patch: LessonPatch): Promise<ProgrammeTemplate | { error: string }> {
  return mutate((p) => {
    for (const stage of p.stages) {
      const lesson = stage.lessons.find((l) => l.id === lessonId);
      if (!lesson) continue;
      if (patch.title !== undefined) { const t = patch.title.trim().slice(0, 200); if (!t) return { error: "A lesson needs a title." }; lesson.title = t; }
      if (patch.outcome !== undefined) lesson.outcome = patch.outcome.trim().slice(0, MAX_TEXT);
      if (patch.content !== undefined) lesson.content = patch.content.trim().slice(0, MAX_TEXT);
      if (patch.videoUrl !== undefined) lesson.videoUrl = patch.videoUrl.trim().slice(0, MAX_TEXT) || undefined;
      if (patch.resourceUrls !== undefined) lesson.resourceUrls = patch.resourceUrls.map((u) => u.trim().slice(0, MAX_TEXT)).filter(Boolean);
      if (patch.toolDeepLink !== undefined) lesson.toolDeepLink = patch.toolDeepLink.trim().slice(0, 100) || undefined;
      if (patch.estimatedMinutes !== undefined) lesson.estimatedMinutes = Number.isFinite(patch.estimatedMinutes) && patch.estimatedMinutes! > 0 ? patch.estimatedMinutes : undefined;
      if (patch.assignment !== undefined) lesson.assignment = patch.assignment ?? undefined;
      return;
    }
    return { error: "Lesson not found." };
  });
}

export async function deleteLesson(lessonId: string): Promise<ProgrammeTemplate | { error: string }> {
  // Splice + tombstone in one locked transaction (see mutate) — atomic delete.
  return mutate((p) => {
    for (const stage of p.stages) {
      const idx = stage.lessons.findIndex((l) => l.id === lessonId);
      if (idx === -1) continue;
      stage.lessons.splice(idx, 1);
      return;
    }
    return { error: "Lesson not found." };
  }, { kind: "lessonIds", id: lessonId });
}

export async function moveLesson(lessonId: string, direction: "up" | "down"): Promise<ProgrammeTemplate | { error: string }> {
  return mutate((p) => {
    for (const stage of p.stages) {
      const ordered = [...stage.lessons].sort((a, b) => a.order - b.order);
      const status = swapOrder(ordered, lessonId, direction);
      if (status === "ok") return;
    }
    return { error: "Lesson not found." };
  });
}

export async function duplicateLesson(lessonId: string): Promise<ProgrammeTemplate | { error: string }> {
  return mutate((p) => {
    for (const stage of p.stages) {
      const lesson = stage.lessons.find((l) => l.id === lessonId);
      if (!lesson) continue;
      if (stage.lessons.length >= MAX_LESSONS_PER_STAGE) return { error: "Too many lessons in this stage already." };
      const copy: LessonTemplate = { ...structuredClone(lesson), id: randomBytes(6).toString("hex"), order: nextOrder(stage.lessons), title: `${lesson.title} (copy)` };
      stage.lessons.push(copy);
      return;
    }
    return { error: "Lesson not found." };
  });
}

export async function setProgrammeStatus(status: "draft" | "published"): Promise<ProgrammeTemplate | { error: string }> {
  return mutate((p) => { p.status = status; });
}

/** Read-only learner-impact check for the admin delete-confirmation UI (see
 *  app/admin/curriculum/page.tsx) — how many learners have touched a
 *  stage/lesson before an admin is asked to confirm deleting it, so that
 *  confirmation isn't asked blind. Never called from deleteStage/deleteLesson
 *  themselves and never blocks a delete — this only informs the dialog shown
 *  before one; the admin can still proceed regardless of the count.
 *
 *  Queries the `enrollments` table directly rather than importing
 *  lib/enrollments.ts: that table's ownership doesn't extend to every reader
 *  of it (app/api/admin/learners/route.ts already reads it directly too, for
 *  a different admin surface), and this module has no other reason to take a
 *  dependency on enrollments.ts. One query total no matter how many lesson
 *  ids are passed — a stage delete passes every lesson id under it in one
 *  call, never N+1 per learner.
 *
 *  "Has progress" mirrors how an EnrollmentLessonEntry comes to exist at all
 *  (see enrollments.ts's startLesson/submitAssignment): an entry is only
 *  ever appended once a learner starts or submits that lesson, so the entry's
 *  mere presence for one of these lesson ids already IS progress worth
 *  warning about. "Awaiting review" mirrors engine's summarizeEnrollment:
 *  the entry's LATEST submission (not just any past one — a newer submission
 *  supersedes an older pending one) has reviewStatus "pending". */
export interface CurriculumDeleteImpact { learnersWithProgress: number; learnersAwaitingReview: number; }

export async function curriculumDeleteImpact(lessonIds: string[]): Promise<CurriculumDeleteImpact> {
  if (lessonIds.length === 0) return { learnersWithProgress: 0, learnersAwaitingReview: 0 };
  const res = await pgPool().query<{ with_progress: string; awaiting_review: string }>(
    `SELECT
       count(DISTINCT e.workspace_id) AS with_progress,
       count(DISTINCT e.workspace_id) FILTER (WHERE entry -> 'submissions' -> -1 ->> 'reviewStatus' = 'pending') AS awaiting_review
     FROM enrollments e, jsonb_array_elements(e.enrollment -> 'lessons') AS entry
     WHERE entry ->> 'lessonId' = ANY($1::text[])`,
    [lessonIds],
  );
  const row = res.rows[0];
  return { learnersWithProgress: Number(row?.with_progress ?? 0), learnersAwaitingReview: Number(row?.awaiting_review ?? 0) };
}
