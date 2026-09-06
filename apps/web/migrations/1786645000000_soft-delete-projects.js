/**
 * Recoverable deletes for funnels (projects) — the "30-day bin".
 *
 * Until now deleting a funnel hard-removed the row. This adds a nullable
 * deleted_at: "delete" now stamps it (a soft delete), so the funnel drops out of
 * the library but is recoverable for 30 days. listProjects/loadProject filter to
 * deleted_at IS NULL; the bin lists rows with deleted_at set; restore clears it;
 * and a daily purge job (lib/jobs.ts) hard-removes anything binned over 30 days
 * ago. Nullable with no default, so every existing (live) row stays live.
 *
 * The partial index keeps the bin/purge scans cheap even as history grows, since
 * it only holds the small set of currently-deleted rows.
 */
exports.up = (pgm) => {
  pgm.addColumn("projects", {
    deleted_at: { type: "timestamptz" }, // null = live; set = in the bin
  });
  pgm.createIndex("projects", ["scope_key", "deleted_at"], {
    name: "projects_deleted_idx",
    where: "deleted_at IS NOT NULL",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("projects", ["scope_key", "deleted_at"], { name: "projects_deleted_idx" });
  pgm.dropColumn("projects", "deleted_at");
};
