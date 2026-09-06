/**
 * Integration framework, second half: OUTBOUND webhooks — the read API
 * (api_keys, /api/v1/*) lets an external tool pull a workspace's data;
 * this lets OneVYRT push to a URL the workspace registers when something
 * happens (today: project.created, project.deleted). The secret is stored
 * in retrievable form (not hashed like api_keys) because it has to be
 * used again on every delivery to sign the outgoing payload — the
 * receiving end needs the same secret to verify it, same model as a
 * Stripe endpoint secret.
 */
exports.up = (pgm) => {
  pgm.createTable("outbound_webhooks", {
    id: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    url: { type: "text", notNull: true },
    secret: { type: "text", notNull: true },
    events: { type: "text[]", notNull: true },
    created_at: { type: "timestamptz", notNull: true },
    last_delivery_at: { type: "timestamptz" },
    last_status: { type: "integer" },
    last_error: { type: "text" },
    disabled_at: { type: "timestamptz" },
  });
  pgm.createIndex("outbound_webhooks", "workspace_id");
};

exports.down = (pgm) => {
  pgm.dropTable("outbound_webhooks");
};
