/**
 * Bound the funnel-event log with a daily rollup.
 *
 * funnel_events gets one row per public funnel view/start — the highest-volume
 * write in the app, on an unauthenticated endpoint. It grows without limit, and
 * it feeds the funnel report's Visited/Started counts, so it couldn't simply be
 * trimmed: dropping old rows would shrink those counts.
 *
 * This rollup holds a per-day count per (workspace, funnel, type). Every event
 * increments today's row, and funnelAnalytics reads its SUM instead of counting
 * raw rows — so the counts become eviction-proof AND the raw funnel_events table
 * can be pruned on a retention window (prune_funnel_events job) without losing a
 * single number. The rollup itself is tiny and bounded: days × funnels × 2 types.
 *
 * Backfill seeds it from every attributed row currently in funnel_events, so the
 * report reads identically the moment this ships. Exact day bucketing (session
 * vs UTC) is irrelevant — analytics SUMs across all days, so the grand totals
 * are the same however individual days split.
 */
exports.up = (pgm) => {
  pgm.createTable("funnel_event_daily", {
    workspace_id: { type: "text", notNull: true },
    funnel_slug: { type: "text", notNull: true },
    type: { type: "text", notNull: true }, // view | start
    day: { type: "date", notNull: true },
    count: { type: "integer", notNull: true, default: 0 },
  });
  pgm.addConstraint("funnel_event_daily", "funnel_event_daily_pkey", {
    primaryKey: ["workspace_id", "funnel_slug", "type", "day"],
  });
  pgm.createIndex("funnel_event_daily", ["workspace_id", "type"]);

  pgm.sql(
    "INSERT INTO funnel_event_daily (workspace_id, funnel_slug, type, day, count) " +
    "SELECT workspace_id, funnel_slug, type, created_at::date, count(*)::int " +
    "FROM funnel_events WHERE workspace_id IS NOT NULL " +
    "GROUP BY workspace_id, funnel_slug, type, created_at::date " +
    "ON CONFLICT (workspace_id, funnel_slug, type, day) DO NOTHING",
  );
};

exports.down = (pgm) => {
  pgm.dropTable("funnel_event_daily");
};
