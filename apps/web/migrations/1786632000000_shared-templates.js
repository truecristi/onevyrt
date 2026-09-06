/**
 * Community-shared funnel templates. A workspace can publish one of its
 * qualification funnels as a public template; any other workspace can browse
 * the gallery and copy it into their own builder. This is the first shared-
 * artifact layer — the seed of the community/expansion direction. The stored
 * `doc` is the funnel structure only (questions, scoring, copy) — no leads, no
 * PII. `uses` counts how many times it's been pulled into a builder.
 */
exports.up = (pgm) => {
  pgm.createTable("shared_templates", {
    id: { type: "text", primaryKey: true },
    author_workspace_id: { type: "text", notNull: true },
    name: { type: "text", notNull: true },
    description: { type: "text" },
    category: { type: "text" },
    doc: { type: "jsonb", notNull: true },
    uses: { type: "integer", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("shared_templates", ["created_at"]);
  pgm.createIndex("shared_templates", ["author_workspace_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("shared_templates");
};
