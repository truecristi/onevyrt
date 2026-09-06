/**
 * v4: insert Chapter 4 (IMPROVE & SCALE) as a real canonical curriculum
 * stage — five new modules (bottleneck → conversion → profit → systemise →
 * the Growth & Improvement Plan) between Chapter 3 and Finish, and remap
 * cohort pacing into the new six-stage order space.
 *
 * Background: v3 (1786800000000_curriculum-master-course-map-v3.js) shipped
 * the canonical 20-module course across five stages (start/chapter-1/2/3/
 * finish, orders 0-4). This migration is PURELY ADDITIVE on top of that: no
 * existing module is renamed, moved, or renumbered — Chapter 4 slots in at
 * order 4, and Finish simply moves from order 4 to order 5 (see
 * packages/engine/src/curriculum-chapters.ts's CURRICULUM_SCHEMA_VERSION 4).
 * Because nothing existing changes shape, no enrollment lesson-id remap is
 * needed this time (contrast the v3 migration's OLD_TO_NEW_LESSON bridge) —
 * every learner's existing progress on modules 1-20 is completely untouched;
 * Chapter 4's five modules simply start unstarted for everyone, same as any
 * other newly-added lesson.
 *
 * What it does, atomically (node-pg-migrate runs this in one transaction):
 *   1. curriculum: every stored programme below CURRICULUM_SCHEMA_VERSION 4 is
 *      rebuilt from the canonical 25-module map (reconcileToChapters(
 *      CANONICAL_PROGRAMME + any admin-created lessons)), exactly the same
 *      pattern the v3 migration used — admin/legacy lessons are preserved in
 *      the "Legacy / Unmapped" stage; already-v4 rows are skipped (idempotent).
 *   2. cohorts: every stored `stage_access_limit` is remapped from the v3
 *      five-stage order space (0..4) to the v4 six-stage space (0..5) via
 *      remapStageAccessLimitForChapter4() — an EXACT remap (unlike the v1→v2
 *      one): every cap 0-3 is unchanged, and the old "everything, including
 *      Finish" cap (4) becomes the new "everything" cap (5), so a cohort that
 *      could already reach Finish is never suddenly re-locked behind a
 *      Chapter 4 it never had. No `pacing_needs_review` flag needed here —
 *      there is no approximation to flag. Guarded so a cap already at 5 (or
 *      any cap outside 0-4) is left alone, making a re-run a no-op.
 *
 * Reversal: `down` is a no-op, matching the v3 migration's reasoning — the
 * curriculum rewrite isn't losslessly reversible in place (the pre-image
 * isn't kept). Roll back a bad deploy by restoring the pre-deploy DB backup
 * (see docs/ONEVYRT_BLUEHOST_DEPLOYMENT.md).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS migration loading the ESM engine's pure, tested transforms
const engine = require("@onevyrt/engine");
const { reconcileToChapters, CANONICAL_PROGRAMME, CURRICULUM_SCHEMA_VERSION, LEGACY_STAGE_ID, remapStageAccessLimitForChapter4 } = engine;

exports.up = async (pgm) => {
  // Ids that belong to the canonical v4 course (m-*) — anything else stored
  // under a stage is an admin-created lesson we must preserve.
  const moduleIds = new Set(CANONICAL_PROGRAMME.stages.flatMap((s) => s.lessons.map((l) => l.id)));

  // 1. Curriculum blobs -> canonical 25-module map (version-gated, idempotent).
  const programmes = await pgm.db.select("SELECT id, programme FROM curriculum");
  for (const row of programmes) {
    const programme = row.programme; // jsonb -> already a JS object
    if ((programme.schemaVersion ?? 1) >= CURRICULUM_SCHEMA_VERSION) continue; // already v4

    // Preserve admin-created lessons (not part of the canonical v4 modules).
    const adminLessons = [];
    for (const stage of programme.stages ?? []) {
      for (const lesson of stage.lessons ?? []) {
        if (!moduleIds.has(lesson.id) && lesson.id !== undefined) adminLessons.push(lesson);
      }
    }
    // Dedupe by id (a lesson already homed correctly shouldn't also show up
    // as a stray "admin" leftover if some other stage happens to repeat it).
    const seenAdmin = new Set();
    const dedupedAdmin = adminLessons.filter((l) => (seenAdmin.has(l.id) ? false : (seenAdmin.add(l.id), true)));

    const base = JSON.parse(JSON.stringify(CANONICAL_PROGRAMME));
    base.id = programme.id;
    base.name = programme.name ?? base.name;
    base.status = programme.status ?? base.status;
    base.createdAt = programme.createdAt ?? base.createdAt;
    if (dedupedAdmin.length > 0) {
      base.stages.push({
        id: LEGACY_STAGE_ID,
        order: base.stages.length,
        title: "Legacy / Unmapped — admin review",
        outcome: "Lessons an admin added that aren't part of the canonical course. Nothing is deleted — review and re-home each one.",
        lessons: dedupedAdmin,
      });
    }
    const reshaped = reconcileToChapters(base); // stamps v4; re-homes admin lessons to legacy
    await pgm.db.query("UPDATE curriculum SET programme = $1 WHERE id = $2", [JSON.stringify(reshaped), row.id]);
  }

  // 2. Cohort pacing -> remap stage_access_limit into the six-stage space.
  //    Guarded to only touch caps still in the OLD (v3) 0-4 range, so a
  //    re-run (or a cohort created fresh after this migration, already in the
  //    v4 space) is left alone rather than double-remapped.
  const cohorts = await pgm.db.select(
    "SELECT id, stage_access_limit FROM cohorts WHERE stage_access_limit IS NOT NULL AND stage_access_limit BETWEEN 0 AND 4",
  );
  for (const c of cohorts) {
    const remapped = remapStageAccessLimitForChapter4(c.stage_access_limit);
    if (remapped === c.stage_access_limit) continue; // 0-3 are unchanged; skip the no-op write
    await pgm.db.query("UPDATE cohorts SET stage_access_limit = $1 WHERE id = $2", [remapped, c.id]);
  }
};

exports.down = async () => {
  // Intentionally not reversed in place — restore the pre-deploy DB backup if
  // the curriculum content or cohort pacing must be rolled back.
};
