/**
 * Fifth migration: `activity` (the per-workspace collaboration feed, see
 * lib/activity.ts — distinct from lib/audit-log.ts, still file-based).
 * Append-mostly and naturally per-row (unlike sessions' single global file,
 * this was already one file per workspace), so targeted SQL per operation,
 * same shape as the projects cutover.
 */
exports.up = (pgm) => {
  pgm.createTable("activity", {
    id: { type: "text", primaryKey: true },
    ws_id: { type: "text", notNull: true },
    at: { type: "timestamptz", notNull: true },
    actor_email: { type: "text", notNull: true },
    action: { type: "text", notNull: true },
    project_name: { type: "text" },
    detail: { type: "text" },
  });
  pgm.createIndex("activity", ["ws_id", "at"]);
};

exports.down = (pgm) => {
  pgm.dropTable("activity");
};
