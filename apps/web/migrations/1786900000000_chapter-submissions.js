/**
 * Chapter-level coach-approval gates (Phase 2 spec §6/§10): at the end of a
 * chapter the learner submits the chapter's OUTPUT (e.g. the Business
 * Psychology Blueprint) as evidence, the coach approves or requests changes,
 * and only an approval unlocks the next chapter. The engine owns the pure
 * state machine (packages/engine/src/chapter-gates.ts — chapterGates +
 * ChapterSubmission); this table is the small persistence overlay the coaching
 * layer keeps (see lib/chapter-submissions.ts).
 *
 * Same shape as enrollments: one jsonb blob per workspace_id, here an ordered
 * list of ChapterSubmission entries. Every call site reads/mutates/writes the
 * whole array under one cross-container advisory lock, so there's no reason to
 * normalise submissions into their own table for this slice.
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS, so a re-run against a DB that already
 * has the table is a no-op rather than an error.
 */
exports.up = (pgm) => {
  pgm.createTable(
    "chapter_submissions",
    {
      workspace_id: { type: "text", primaryKey: true },
      submissions: { type: "jsonb", notNull: true, default: pgm.func("'[]'::jsonb") },
    },
    { ifNotExists: true },
  );
};

exports.down = (pgm) => {
  pgm.dropTable("chapter_submissions");
};
