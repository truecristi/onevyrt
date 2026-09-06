/**
 * Observability: persist client-side render crashes (posted to
 * /api/client-error by the error boundaries) so an admin can actually see them
 * in the UI, instead of them only landing in the server log file. A short,
 * capped, queryable list — same shape and retention as audit_log.
 */
exports.up = (pgm) => {
  pgm.createTable("client_errors", {
    id: { type: "text", primaryKey: true },
    at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    message: { type: "text", notNull: true },
    url: { type: "text" },
    digest: { type: "text" },
    stack: { type: "text" },
  });
  pgm.createIndex("client_errors", "at", { name: "client_errors_at" });
};

exports.down = (pgm) => {
  pgm.dropTable("client_errors");
};
