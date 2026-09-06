/**
 * v3: replace the curriculum content with the canonical 20-module Master Course
 * Map, and BRIDGE every learner's progress across the lesson-id change.
 *
 * Background: v2 organised the old 22 lessons (ids l-0-1 … l-10-2) into the three
 * chapters. v3 rewrites the actual course to the 20 named modules (ids
 * m-start-assessment … m-finish-transformation), each wired to its tool. Because
 * the ids change, enrollments — which join to the curriculum by lesson id — must
 * be remapped, or learners would lose their place. Both the new content and the
 * old→new id map live in the engine (curriculum-content.ts / curriculum-chapters.ts)
 * as pure, tested values; this migration is the one place that applies them to
 * persisted rows. node-pg-migrate runs it in a single transaction, so any failure
 * rolls the whole thing back.
 *
 * What it does, atomically:
 *   1. curriculum: every stored programme below v3 is rebuilt to the canonical
 *      20-module shape (reconcileToChapters(CANONICAL_PROGRAMME + any admin-created
 *      lessons)). Admin/legacy lessons are preserved in the "Legacy / Unmapped"
 *      stage; the superseded old l-*-* lessons are dropped from the course (their
 *      PROGRESS is carried by step 2, not their content). Already-v3 rows are
 *      skipped (idempotent).
 *   2. enrollments: every stored enrollment that still references an old lesson id
 *      is run through remapEnrollmentLessonIds(OLD_TO_NEW_LESSON) — ids renamed,
 *      entries that collapse onto one module merged (most-advanced status wins,
 *      submissions unioned). Rows with no old ids are left untouched, so a re-run
 *      is a no-op.
 *
 * Cohorts need no change here: stage_access_limit already lives in the five-stage
 * order space (the v2 migration moved it there) and the five stages are unchanged.
 *
 * Reversal: `down` is a no-op — the curriculum/enrollment rewrite isn't losslessly
 * reversible in place (the pre-image isn't kept). Roll back a bad deploy by
 * restoring the DB backup taken before it (a hard pre-deploy gate — see
 * docs/ONEVYRT_BLUEHOST_DEPLOYMENT.md).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS migration loading the ESM engine's pure, tested transforms
const engine = require("@onevyrt/engine");
const { reconcileToChapters, remapEnrollmentLessonIds, CANONICAL_PROGRAMME, OLD_TO_NEW_LESSON, CURRICULUM_SCHEMA_VERSION, LEGACY_STAGE_ID } = engine;

exports.up = async (pgm) => {
  // Ids that belong to the new course (m-*) and the known old seed (l-*); anything
  // else stored under a stage is an admin-created lesson we must preserve.
  const moduleIds = new Set(CANONICAL_PROGRAMME.stages.flatMap((s) => s.lessons.map((l) => l.id)));
  const oldSeedIds = new Set(Object.keys(OLD_TO_NEW_LESSON));

  // 1. Curriculum blobs -> canonical 20-module map (version-gated, idempotent).
  const programmes = await pgm.db.select("SELECT id, programme FROM curriculum");
  for (const row of programmes) {
    const programme = row.programme; // jsonb -> already a JS object
    if ((programme.schemaVersion ?? 1) >= CURRICULUM_SCHEMA_VERSION) continue; // already v3

    // Preserve admin-created lessons (not part of the old seed nor the new modules).
    const adminLessons = [];
    for (const stage of programme.stages ?? []) {
      for (const lesson of stage.lessons ?? []) {
        if (!moduleIds.has(lesson.id) && !oldSeedIds.has(lesson.id)) adminLessons.push(lesson);
      }
    }

    const base = JSON.parse(JSON.stringify(CANONICAL_PROGRAMME));
    base.id = programme.id;
    base.name = programme.name ?? base.name;
    base.status = programme.status ?? base.status;
    base.createdAt = programme.createdAt ?? base.createdAt;
    if (adminLessons.length > 0) {
      base.stages.push({
        id: LEGACY_STAGE_ID,
        order: base.stages.length,
        title: "Legacy / Unmapped — admin review",
        outcome: "Lessons an admin added that aren't part of the canonical course. Nothing is deleted — review and re-home each one.",
        lessons: adminLessons,
      });
    }
    const reshaped = reconcileToChapters(base); // stamps v3; re-homes admin lessons to legacy
    await pgm.db.query("UPDATE curriculum SET programme = $1 WHERE id = $2", [JSON.stringify(reshaped), row.id]);
  }

  // 2. Enrollments -> bridge lesson ids from the old seed to the new modules.
  const enrollments = await pgm.db.select("SELECT workspace_id, enrollment FROM enrollments");
  for (const row of enrollments) {
    const enrollment = row.enrollment;
    if (!enrollment || !Array.isArray(enrollment.lessons)) continue;
    const referencesOld = enrollment.lessons.some((l) => OLD_TO_NEW_LESSON[l.lessonId]);
    if (!referencesOld) continue; // already migrated, or never touched an old lesson
    const remapped = remapEnrollmentLessonIds(enrollment, OLD_TO_NEW_LESSON);
    await pgm.db.query("UPDATE enrollments SET enrollment = $1 WHERE workspace_id = $2", [JSON.stringify(remapped), row.workspace_id]);
  }
};

exports.down = async () => {
  // Intentionally not reversed in place — restore the pre-deploy DB backup if the
  // curriculum content must be rolled back.
};
