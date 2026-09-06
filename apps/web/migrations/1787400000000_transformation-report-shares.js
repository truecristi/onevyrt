/**
 * Transformation Report share links (see
 * lib/reports/transformation-report-shares.ts) — the Chapter 4 (IMPROVE &
 * SCALE) enhanced Transformation Report's public share surface, at
 * /share/transformation/[token]. Kept as its own table rather than reusing
 * report_shares: this is keyed by workspace alone (no project_id) and
 * carries a much shorter, fixed 24-hour lifetime.
 */
exports.up = (pgm) => {
  pgm.createTable("transformation_report_shares", {
    token: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    html: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true },
    expires_at: { type: "bigint", notNull: true },
  });
  pgm.createIndex("transformation_report_shares", ["workspace_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("transformation_report_shares");
};
