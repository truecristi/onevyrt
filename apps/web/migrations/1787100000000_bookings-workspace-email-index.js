/**
 * Index bookings(workspace_id, lower(email)) for the segment build.
 *
 * The "has booked" segment rule (lib/segments/rules.ts) evaluates, for every
 * lead in a workspace, a correlated
 *   EXISTS (SELECT 1 FROM bookings b
 *           WHERE b.workspace_id = l.workspace_id AND lower(b.email) = lower(l.email))
 * The existing bookings indexes are on (funnel_slug, slot_start) and
 * (workspace_id, slot_start) — neither helps a lookup keyed on
 * workspace_id + lower(email), so each lead triggers a scan of the workspace's
 * bookings. This functional index lets that EXISTS probe the booking directly,
 * so a segment build stays roughly linear in leads instead of leads × bookings.
 */
exports.up = (pgm) => {
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS bookings_workspace_id_lower_email_idx " +
    "ON bookings (workspace_id, lower(email))",
  );
};

exports.down = (pgm) => {
  pgm.sql("DROP INDEX IF EXISTS bookings_workspace_id_lower_email_idx");
};
