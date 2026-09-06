/**
 * Phase 1: reshape the curriculum into the canonical three-chapter arc, and
 * safely remap cohort pacing to the new five-stage order space.
 *
 * WHY a migration (not a read-time reconcile): the reshape must happen exactly
 * once, be verifiable (a stored `schemaVersion`), and never mutate a programme
 * as a side effect of an ordinary read. The pure, tested transform lives in the
 * engine (packages/engine/src/curriculum-chapters.ts); this migration is the
 * one place that applies it to persisted rows. `require`-ing the ESM engine
 * from this CommonJS migration is supported on the runtime (Node 22 require(esm)).
 *
 * What it does, atomically — node-pg-migrate runs each migration in a single
 * transaction, so any failure rolls the whole thing back:
 *   1. curriculum: every stored programme below CURRICULUM_SCHEMA_VERSION is run
 *      through reconcileToChapters() — 11 flat stages become Start / Chapter 1 /
 *      Chapter 2 / Chapter 3 / Finish, every lesson & assignment id preserved,
 *      and any admin/legacy lesson kept in a "Legacy / Unmapped" stage. Already-
 *      canonical programmes are skipped (idempotent).
 *   2. cohorts: add two audit columns, then remap stage_access_limit from the old
 *      stage-order space (0..10) to the new one (0..4) via remapStageAccessLimit()
 *      — which never unlocks a cohort past where it was. The ORIGINAL value is
 *      preserved in stage_access_limit_legacy, and any cohort whose cap could not
 *      be mapped exactly is flagged (pacing_needs_review = true) for a coach to
 *      re-set, rather than silently guessing. Guarded on legacy IS NULL so a
 *      re-run never double-remaps.
 *
 * Enrollments / submissions / reviews need no migration: they join to curriculum
 * by lesson id only, and every lesson id is preserved by the transform.
 *
 * Reversal: `down` drops the two audit columns. The curriculum reshape is not
 * losslessly reversible in place (the pre-image isn't kept) — roll back a bad
 * deploy by restoring the DB backup taken before it (see RUNBOOK.md and
 * docs/ONEVYRT_BLUEHOST_DEPLOYMENT.md), which is why that backup is a hard
 * pre-deploy gate.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS migration loading the ESM engine's pure, tested transforms
const { reconcileToChapters, remapStageAccessLimit, CURRICULUM_SCHEMA_VERSION } = require("@onevyrt/engine");

exports.up = async (pgm) => {
  // 1. Curriculum blobs -> canonical three-chapter arc (version-gated, idempotent).
  const programmes = await pgm.db.select("SELECT id, programme FROM curriculum");
  for (const row of programmes) {
    const programme = row.programme; // jsonb -> already a JS object
    if ((programme.schemaVersion ?? 1) >= CURRICULUM_SCHEMA_VERSION) continue; // already canonical
    const reshaped = reconcileToChapters(programme);
    await pgm.db.query("UPDATE curriculum SET programme = $1 WHERE id = $2", [JSON.stringify(reshaped), row.id]);
  }

  // 2. Cohort pacing-audit columns (idempotent DDL).
  await pgm.db.query("ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS stage_access_limit_legacy integer");
  await pgm.db.query("ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS pacing_needs_review boolean NOT NULL DEFAULT false");

  // 3. Conservatively remap each cohort's cap; preserve the original and flag
  //    inexact maps. Guard on legacy IS NULL so a re-run is a no-op.
  const cohorts = await pgm.db.select(
    "SELECT id, stage_access_limit FROM cohorts WHERE stage_access_limit_legacy IS NULL AND stage_access_limit IS NOT NULL",
  );
  for (const c of cohorts) {
    const { value, exact } = remapStageAccessLimit(c.stage_access_limit);
    await pgm.db.query(
      "UPDATE cohorts SET stage_access_limit = $1, stage_access_limit_legacy = $2, pacing_needs_review = $3 WHERE id = $4",
      [value, c.stage_access_limit, !exact, c.id],
    );
  }
};

exports.down = async (pgm) => {
  await pgm.db.query("ALTER TABLE cohorts DROP COLUMN IF EXISTS pacing_needs_review");
  await pgm.db.query("ALTER TABLE cohorts DROP COLUMN IF EXISTS stage_access_limit_legacy");
  // The curriculum reshape is intentionally not reversed in place — restore the
  // pre-deploy DB backup if the curriculum shape must be rolled back.
};
