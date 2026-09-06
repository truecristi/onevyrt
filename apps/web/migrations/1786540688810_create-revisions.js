/**
 * Tenth migration: version-history snapshots (see lib/revisions.ts). Was an
 * index file plus one doc file per revision, per (scope, project) — folded
 * into a single per-row table here (Postgres doesn't need the
 * meta/doc-file split that existed purely to avoid rewriting large blobs
 * inside the index file). Insert, then trim past MAX_REVISIONS (50) for
 * that project, same bounded-growth shape as activity/comments.
 */
exports.up = (pgm) => {
  pgm.createTable("revisions", {
    id: { type: "text", primaryKey: true },
    scope_key: { type: "text", notNull: true },
    project_id: { type: "text", notNull: true },
    user_id: { type: "text", notNull: true },
    email: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true },
    note: { type: "text", notNull: true, default: "" },
    revenue: { type: "numeric" },
    profit: { type: "numeric" },
    doc: { type: "text", notNull: true },
  });
  pgm.createIndex("revisions", ["scope_key", "project_id", "created_at"]);
};

exports.down = (pgm) => {
  pgm.dropTable("revisions");
};
