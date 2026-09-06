/**
 * Extends the recoverable-bin pattern (soft-delete-projects,
 * soft-delete-segments-campaigns) to the Acquisition OS's PII-bearing tables:
 * leads, bookings, and their lead_events activity log. Until now, deleting the
 * workspace that captured a lead only removed the workspace row + its
 * projects (see store.ts deleteScope) — the lead's name/email/phone/answers
 * were orphaned, not erased, and lived forever.
 *
 * Each table gains a nullable deleted_at: account/workspace deletion
 * (lib/auth.ts purgeUser, via lib/workspaces.ts adminDeleteWorkspace) now
 * stamps it for every row scoped to the deleted workspace(s) instead of
 * hard-deleting immediately — the same "soft-delete now, hard-delete after
 * the retention window" shape project deletion already uses via its own bin,
 * so a wrongful/mistaken deletion stays recoverable for the same window
 * before it's gone for good. Every read of these tables (lib/acquisition/
 * leads.ts, funnel-events.ts, segments/store.ts + rules.ts,
 * campaign/creatives-store.ts, acquisition/bookings.ts) filters to
 * deleted_at IS NULL, so a soft-deleted row stops appearing anywhere — inbox,
 * analytics, segment/broadcast audiences — the moment it's marked, well
 * before the purge job actually removes it. The daily purge_deleted_leads job
 * (lib/jobs.ts, calling lib/acquisition/leads.ts purgeExpiredLeadsAndBookings)
 * hard-removes anything binned past the retention window, mirroring
 * purgeExpiredProjects/purgeExpiredRows.
 *
 * Nullable with no default, so every existing (live) row stays live. Partial
 * indexes (scoped by workspace_id, same key every cascade/read already
 * filters by) keep the purge/read scans cheap — each only ever holds the
 * small set of currently soft-deleted rows for that table.
 */
exports.up = (pgm) => {
  for (const table of ["leads", "bookings", "lead_events"]) {
    pgm.addColumn(table, { deleted_at: { type: "timestamptz" } });
    pgm.createIndex(table, ["workspace_id", "deleted_at"], {
      name: `${table}_deleted_idx`,
      where: "deleted_at IS NOT NULL",
    });
  }
};

exports.down = (pgm) => {
  for (const table of ["leads", "bookings", "lead_events"]) {
    pgm.dropIndex(table, ["workspace_id", "deleted_at"], { name: `${table}_deleted_idx` });
    pgm.dropColumn(table, "deleted_at");
  }
};
