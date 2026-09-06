/**
 * Ninth migration: project comments (see lib/comments.ts). Was one file per
 * (scope, project) pair — naturally per-row — so targeted SQL, same shape
 * as activity: insert, then trim past MAX_PER_PROJECT (500) for that
 * project, matching the file version's bounded-growth behavior.
 */
exports.up = (pgm) => {
  pgm.createTable("comments", {
    id: { type: "text", primaryKey: true },
    scope_key: { type: "text", notNull: true },
    project_id: { type: "text", notNull: true },
    user_id: { type: "text", notNull: true },
    email: { type: "text", notNull: true },
    text: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true },
  });
  pgm.createIndex("comments", ["scope_key", "project_id", "created_at"]);
};

exports.down = (pgm) => {
  pgm.dropTable("comments");
};
