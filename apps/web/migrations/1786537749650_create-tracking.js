/**
 * Sixth migration: live tracking (see lib/tracking.ts). Three sub-stores,
 * each migrated with the shape that actually fits it:
 *  - tracking_keys: was a single global key->{scopeKey,projectId} map file,
 *    now a proper per-row table (this one's a clean upgrade, not just a port).
 *  - tracking_counts: was one aggregated-counts blob per tracking key, now a
 *    per-(key, node_id) row — lets Postgres do atomic increments
 *    (ON CONFLICT DO UPDATE SET visits = visits + 1) instead of read-modify-
 *    write, which is a genuine concurrency improvement over the file version,
 *    not just a port of it.
 *  - tracking_journeys: was one JSON blob per key holding the whole session
 *    array (nested events, capped at 300 sessions / 500 events each) — kept
 *    as one jsonb blob per key rather than fully normalizing, still guarded
 *    by the same in-process withFileLock trick used for users/workspaces,
 *    since redesigning the session-cap/event-cap logic in SQL isn't worth it
 *    for a feature the code already calls "best-effort."
 */
exports.up = (pgm) => {
  pgm.createTable("tracking_keys", {
    key: { type: "text", primaryKey: true },
    scope_key: { type: "text", notNull: true },
    project_id: { type: "text", notNull: true },
  });
  pgm.createIndex("tracking_keys", ["scope_key", "project_id"]);

  pgm.createTable("tracking_counts", {
    key: { type: "text", notNull: true },
    node_id: { type: "text", notNull: true },
    visits: { type: "integer", notNull: true, default: 0 },
    conversions: { type: "integer", notNull: true, default: 0 },
    revenue: { type: "integer", notNull: true, default: 0 },
  });
  pgm.addConstraint("tracking_counts", "tracking_counts_pkey", { primaryKey: ["key", "node_id"] });

  pgm.createTable("tracking_journeys", {
    key: { type: "text", primaryKey: true },
    sessions: { type: "jsonb", notNull: true, default: "[]" },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("tracking_journeys");
  pgm.dropTable("tracking_counts");
  pgm.dropTable("tracking_keys");
};
