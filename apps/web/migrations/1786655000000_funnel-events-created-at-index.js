/**
 * Index funnel_events(created_at) for the retention prune.
 *
 * The prune_funnel_events job runs `DELETE FROM funnel_events WHERE created_at <
 * $cutoff` on the app's highest-volume table. Its existing indexes are on
 * (workspace_id, type) and (funnel_slug, type), neither of which helps a
 * created_at range — so the nightly prune would seq-scan the whole table. This
 * index lets it find the expired rows directly.
 */
exports.up = (pgm) => {
  pgm.createIndex("funnel_events", "created_at", { name: "funnel_events_created_at_idx" });
};

exports.down = (pgm) => {
  pgm.dropIndex("funnel_events", "created_at", { name: "funnel_events_created_at_idx" });
};
