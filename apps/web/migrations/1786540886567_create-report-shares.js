/**
 * Eleventh migration: report share links (see lib/report-shares.ts), the
 * one deliberately public-facing surface — /share/[token]. Was a single
 * token -> entry map file, naturally per-row, targeted SQL.
 */
exports.up = (pgm) => {
  pgm.createTable("report_shares", {
    token: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    project_id: { type: "text", notNull: true },
    html: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true },
    expires_at: { type: "bigint", notNull: true },
  });
  pgm.createIndex("report_shares", ["workspace_id", "project_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("report_shares");
};
