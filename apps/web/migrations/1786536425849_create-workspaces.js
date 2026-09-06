/**
 * Third migration in the JSON-file -> Postgres move: `workspaces`, mirroring
 * lib/workspaces.ts's Workspace shape. Same reasoning as `users`: every
 * function in that file already does full read/mutate/write of the whole
 * array under one in-process lock, so readAll/writeAll keep that exact
 * contract on the Postgres side (full read, transactional full-table sync
 * on write) instead of rewriting ~13 call sites to targeted SQL. `members`
 * is stored as jsonb rather than a separate table — same simplification,
 * revisit once real per-member queries are actually needed.
 */
exports.up = (pgm) => {
  pgm.createTable("workspaces", {
    id: { type: "text", primaryKey: true },
    name: { type: "text", notNull: true },
    owner_id: { type: "text", notNull: true },
    members: { type: "jsonb", notNull: true, default: "[]" },
    created_at: { type: "timestamptz", notNull: true },
    plan: { type: "text" },
    stripe_customer_id: { type: "text" },
  });
  pgm.createIndex("workspaces", "owner_id");
};

exports.down = (pgm) => {
  pgm.dropTable("workspaces");
};
