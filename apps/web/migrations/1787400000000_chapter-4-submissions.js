/**
 * Chapter 4 (IMPROVE & SCALE) submission storage — the learner's Growth &
 * Improvement Plan: current position → biggest bottleneck → action plan →
 * 90-day impact projection, built up subchapter by subchapter (4.1–4.6) and
 * submitted to a coach for approval. See lib/chapter4-submissions.ts for the
 * full read/write API and the reasoning for keeping this separate from the
 * generic `chapter_submissions` table (chapters 1–3's free-text evidence
 * model doesn't fit this artifact's richer structured data).
 *
 * One row per workspace_id, like chapter_submissions/enrollments: `data`
 * holds the whole plan as one jsonb document, mutated under a cross-container
 * advisory lock (db.ts withAdvisoryLock) so concurrent subchapter saves for
 * the SAME workspace serialize instead of clobbering each other.
 *
 * `id` is a separate stable opaque identifier (independent of workspace_id)
 * so API responses have a genuine "submission id" to hand back, per the
 * roadmap's original UUID-keyed sketch — generated once when a workspace's
 * first Chapter 4 save happens and never reissued after.
 *
 * `coach_decision`/`coach_feedback`/`reviewed_at`/`reviewed_by` are written by
 * this slice's future coach-review endpoint (a separate, parallel lane per
 * docs/IMPLEMENTATION_ROADMAP.md's Wave 0 scope item 6) — declared here now so
 * that lane has a stable column set to land against instead of a second
 * migration; this slice only ever reads them.
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS, so a re-run against a DB that
 * already has the table is a no-op rather than an error.
 */
exports.up = (pgm) => {
  pgm.createTable(
    "chapter_4_submissions",
    {
      workspace_id: { type: "text", primaryKey: true },
      id: { type: "text", notNull: true },
      status: { type: "text", notNull: true, default: "in_progress" }, // in_progress | submitted | changes_requested | approved
      data: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
      submitted_at: { type: "timestamptz" },
      submitted_by: { type: "text" },
      reviewed_at: { type: "timestamptz" },
      reviewed_by: { type: "text" },
      coach_decision: { type: "text" }, // approved | changes_requested
      coach_feedback: { type: "text" },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    },
    { ifNotExists: true },
  );
  // The submission id is looked up on its own by a future share/PDF surface
  // (see components/programme/GrowthImprovementPlan.tsx's header); unique so
  // it's a safe alternate key even though workspace_id stays the primary key
  // every read/write in this slice actually uses.
  pgm.createIndex("chapter_4_submissions", ["id"], { unique: true, ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable("chapter_4_submissions");
};
