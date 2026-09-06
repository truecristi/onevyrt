/**
 * Campaign Studio — campaigns. One row per campaign in a workspace. The
 * ordered marketing sequence ("flow") lives in a jsonb column so a campaign's
 * steps can vary freely without a second table. Templates are code-defined
 * starting points (lib/templates.ts) that seed a campaign's flow; they are not
 * stored here. Indexed by workspace_id since every read is workspace-scoped.
 */
exports.up = (pgm) => {
  pgm.createTable("campaigns", {
    id: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    name: { type: "text", notNull: true },
    objective: { type: "text", notNull: true, default: "" },
    status: { type: "text", notNull: true, default: "draft" },
    channel: { type: "text", notNull: true, default: "" },
    budget: { type: "text", notNull: true, default: "" },
    starts_at: { type: "text", notNull: true, default: "" },
    ends_at: { type: "text", notNull: true, default: "" },
    template_id: { type: "text", notNull: true, default: "" },
    flow: { type: "jsonb", notNull: true, default: "[]" },
    created_at: { type: "timestamptz", notNull: true },
    updated_at: { type: "timestamptz", notNull: true },
  });
  pgm.createIndex("campaigns", "workspace_id");
};

exports.down = (pgm) => {
  pgm.dropTable("campaigns");
};
