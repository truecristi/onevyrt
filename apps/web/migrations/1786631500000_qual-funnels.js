/**
 * Persisted qualification funnels — the builder's output. Each row is one
 * funnel a workspace owns, stored as the builder `doc` (the friendly model);
 * the runtime compiles it to engine rules on read. `published` gates whether
 * the public /q/[slug] route serves it. slug is globally unique (it's a public
 * URL), so two workspaces can't claim the same one.
 */
exports.up = (pgm) => {
  pgm.createTable("qual_funnels", {
    slug: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    doc: { type: "jsonb", notNull: true },
    published: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("qual_funnels", ["workspace_id", "updated_at"]);
};

exports.down = (pgm) => {
  pgm.dropTable("qual_funnels");
};
