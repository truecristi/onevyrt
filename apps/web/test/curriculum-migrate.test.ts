import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";
import { CURRICULUM_SCHEMA_VERSION, allLessons, type ProgrammeTemplate } from "@onevyrt/engine";

/**
 * Exercises the REAL v3 migration (the 20-module Master Course Map) against a
 * Postgres DB, using a `pgm` shim that delegates to the pool — the same
 * db.query / db.select surface node-pg-migrate hands a migration. It proves the
 * production-relevant upgrade: a v2 install (the old 22-lesson ids arranged in
 * the three-chapter arc) is rebuilt to the 20 named modules AND every enrollment
 * is bridged from the old lesson ids to the new module ids, so a learner's place
 * and submissions survive. Runs only with DATABASE_URL; fixtures use uid() ids
 * and are cleaned up, and the migration only rewrites NON-canonical curriculum
 * rows + enrollments that still reference an old id, so it never disturbs the
 * live singleton. (The historical v1→v2 cohort-pacing remap is covered at the
 * unit level in packages/engine curriculum-chapters.test.ts.)
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const migration = require("../migrations/1786800000000_curriculum-master-course-map-v3.js");

const pool = pgPool();
const pgm = {
  db: {
    query: (sql: string, params?: unknown[]) => pool.query(sql, params),
    select: async (sql: string, params?: unknown[]) => (await pool.query(sql, params)).rows,
  },
};

const PROG_ID = uid("prog");
const WS_ID = uid("ws");

/** A v2 programme: old lesson ids in the three-chapter arc, schemaVersion 2 —
 *  exactly what a real pre-v3 install has. Includes an admin-created lesson
 *  (unknown id) that must be preserved, and two follow-up lessons (l-7-1/l-7-2)
 *  that both collapse onto the Sales System module. */
function v2Programme(id: string): ProgrammeTemplate {
  return {
    id, name: "Test Programme", status: "published", schemaVersion: 2, createdAt: "t", updatedAt: "t",
    stages: [
      { id: "chapter-2", order: 2, title: "old ch2", outcome: "o", lessons: [
        { id: "l-7-1", order: 1, title: "Follow-up", outcome: "o", content: "c",
          assignment: { id: "a-7-1", title: "A", instructions: "i", evidencePrompt: "e", checklist: [{ id: "c1", label: "x" }] } },
        { id: "l-7-2", order: 2, title: "Close", outcome: "o", content: "c" },
      ] },
      { id: "chapter-1", order: 1, title: "old ch1", outcome: "o", lessons: [
        { id: "adm-custom", order: 1, title: "Admin lesson", outcome: "o", content: "c" },
      ] },
    ],
  } as ProgrammeTemplate;
}

async function readProgramme(id: string): Promise<ProgrammeTemplate> {
  const r = await pool.query<{ programme: ProgrammeTemplate }>("SELECT programme FROM curriculum WHERE id = $1", [id]);
  return r.rows[0]!.programme;
}
async function readEnrollment(ws: string): Promise<{ lessons: { lessonId: string; status: string; submissions: unknown[] }[] }> {
  const r = await pool.query<{ enrollment: { lessons: { lessonId: string; status: string; submissions: unknown[] }[] } }>(
    "SELECT enrollment FROM enrollments WHERE workspace_id = $1", [ws]);
  return r.rows[0]!.enrollment;
}

before(async () => {
  await pool.query("INSERT INTO curriculum (id, programme) VALUES ($1, $2)", [PROG_ID, JSON.stringify(v2Programme(PROG_ID))]);
  await pool.query(
    "INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2)",
    [WS_ID, JSON.stringify({
      id: uid("enr"), programmeId: PROG_ID, workspaceId: WS_ID, userId: uid("u"), deliveryMode: "self_paced", startedAt: "t",
      lessons: [
        { lessonId: "l-7-1", status: "in_progress", submissions: [] },
        { lessonId: "l-7-2", status: "approved", submissions: [] },
      ],
    })],
  );
  await migration.up(pgm);
});

after(async () => {
  await pool.query("DELETE FROM curriculum WHERE id = $1", [PROG_ID]);
  await pool.query("DELETE FROM enrollments WHERE workspace_id = $1", [WS_ID]);
});

test("v3 migration: a v2 curriculum is rebuilt to the current canonical course, stamped current", async () => {
  const p = await readProgramme(PROG_ID);
  assert.equal(p.schemaVersion, CURRICULUM_SCHEMA_VERSION);
  // This migration rebuilds curriculum CONTENT from CANONICAL_PROGRAMME
  // wholesale (not from the v2 fixture's own lesson bodies — only admin/
  // unrecognized leftovers are preserved, in "legacy"), so it always reflects
  // whatever CANONICAL_PROGRAMME currently is — now six stages / 25 modules,
  // Chapter 4 included (see curriculum-chapters.ts), not frozen at "v3"'s 20.
  assert.deepEqual(
    p.stages.filter((s) => s.id !== "legacy-unmapped").map((s) => s.id),
    ["start", "chapter-1", "chapter-2", "chapter-3", "chapter-4", "finish"],
  );
  assert.equal(p.stages.find((s) => s.id === "chapter-4")!.lessons.length, 5);
  const ids = allLessons(p).map((l) => l.id);
  const modules = ids.filter((id) => id.startsWith("m-"));
  assert.equal(modules.length, 25, "all 25 canonical modules are present, including Chapter 4's 5");
  assert.ok(ids.includes("m-sales-system"));
  assert.ok(ids.includes("m-bottleneck"), "Chapter 4's modules are part of the rebuilt course too");
  // the superseded old seed ids are gone from the course (progress is bridged separately)
  assert.ok(!ids.includes("l-7-1") && !ids.includes("l-7-2"));
});

test("v3 migration: an admin-created lesson is preserved (in legacy), not dropped", async () => {
  const p = await readProgramme(PROG_ID);
  const legacy = p.stages.find((s) => s.id === "legacy-unmapped");
  assert.ok(legacy, "legacy stage exists to hold admin lessons");
  assert.ok(legacy.lessons.some((l) => l.id === "adm-custom"), "the admin lesson survived");
});

test("v3 migration: enrollment progress is bridged — old ids collapse onto the new module, most-advanced status wins", async () => {
  const e = await readEnrollment(WS_ID);
  assert.equal(e.lessons.length, 1, "l-7-1 + l-7-2 collapse to one entry");
  assert.equal(e.lessons[0]!.lessonId, "m-sales-system");
  assert.equal(e.lessons[0]!.status, "approved"); // approved (l-7-2) beats in_progress (l-7-1)
});

test("v3 migration: idempotent — a second run changes nothing", async () => {
  const beforeP = await readProgramme(PROG_ID);
  const beforeE = await readEnrollment(WS_ID);
  await migration.up(pgm); // run again — curriculum already v3 (skipped), enrollment has no old ids (skipped)
  assert.deepEqual(await readProgramme(PROG_ID), beforeP);
  assert.deepEqual(await readEnrollment(WS_ID), beforeE);
});
