/**
 * Chapter 4 (IMPROVE & SCALE) completion tracking on `enrollments` — the first
 * columns added to that table since its original migration
 * (1786541862535_create-enrollments.js: workspace_id text PK + enrollment
 * jsonb). See docs/IMPLEMENTATION_ROADMAP.md's "Chapter 4: IMPROVE & SCALE"
 * section (Database Changes Required) for the schema this implements, and
 * apps/web/prisma/schema-updates/chapter-4.prisma for the same schema kept as
 * a documented spec — update both if either changes.
 *
 * chapter_4_submission_id points at this workspace's row in
 * chapter_4_submissions (apps/web/migrations/1787400000000_chapter-4-
 * submissions.js) once that plan reaches "approved" — the one signal that
 * gates progression to Finish, the same role a chapter's `evidence`
 * submission plays for chapters 1-3 in the generic chapter_submissions table
 * (see packages/engine/src/chapter-gates.ts). chapter_4_completed_at is
 * stamped alongside it, so Finish-stage gating and reporting can read a plain
 * timestamp column instead of joining chapter_4_submissions or recomputing
 * chapterGates() just to check Chapter 4.
 *
 * Both columns are nullable and default to unset: every enrollment created
 * before this migration (and every workspace that hasn't reached Chapter 4
 * yet) simply has both as NULL, meaning "not completed" — no backfill needed.
 *
 * No foreign key on chapter_4_submission_id, matching every other reference
 * in this codebase (e.g. leads.assignee_id, 1786648000000_lead-assignment.js)
 * — the coach-review endpoint that sets it validates against
 * chapter_4_submissions itself before writing, not Postgres. No secondary
 * index either: the only read pattern so far is "this workspace's own
 * enrollment row", already served by the existing workspace_id primary key —
 * an index keyed on chapter_4_submission_id or chapter_4_completed_at can be
 * added later if a "which workspaces finished Chapter 4" query needs one.
 */
exports.up = (pgm) => {
  pgm.addColumns("enrollments", {
    chapter_4_submission_id: { type: "text" },
    chapter_4_completed_at: { type: "timestamptz" },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns("enrollments", ["chapter_4_submission_id", "chapter_4_completed_at"]);
};
