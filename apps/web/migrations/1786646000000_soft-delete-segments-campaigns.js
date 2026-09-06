/**
 * Extends the 30-day recoverable bin (added for funnels) to segments and
 * campaigns. Each gains a nullable deleted_at: delete stamps it (a soft delete),
 * lists filter to deleted_at IS NULL, restore clears it, and the daily purge job
 * hard-removes anything binned over 30 days ago (see lib/soft-delete.ts,
 * lib/jobs.ts). Nullable with no default, so every existing row stays live.
 *
 * A partial index per table keeps the bin/purge scans cheap — it only holds the
 * small set of currently-deleted rows.
 */
exports.up = (pgm) => {
  for (const table of ["segments", "campaigns"]) {
    pgm.addColumn(table, { deleted_at: { type: "timestamptz" } });
    pgm.createIndex(table, ["workspace_id", "deleted_at"], {
      name: `${table}_deleted_idx`,
      where: "deleted_at IS NOT NULL",
    });
  }
};

exports.down = (pgm) => {
  for (const table of ["segments", "campaigns"]) {
    pgm.dropIndex(table, ["workspace_id", "deleted_at"], { name: `${table}_deleted_idx` });
    pgm.dropColumn(table, "deleted_at");
  }
};
