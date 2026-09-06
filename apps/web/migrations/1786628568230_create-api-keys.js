/**
 * Read-only public API for a workspace's own data (Ch. integration
 * framework): a user mints a bearer key scoped to one workspace, used by
 * external tools (Zapier, a script, a BI dashboard) to pull projects
 * programmatically instead of only through the browser session cookie.
 * Only the salted hash is stored — like password hashes, the raw key is
 * shown once at creation and never persisted or recoverable.
 */
exports.up = (pgm) => {
  pgm.createTable("api_keys", {
    id: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    user_id: { type: "text", notNull: true },
    name: { type: "text", notNull: true },
    prefix: { type: "text", notNull: true },
    key_hash: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true },
    last_used_at: { type: "timestamptz" },
    revoked_at: { type: "timestamptz" },
  });
  pgm.createIndex("api_keys", "workspace_id");
  pgm.createIndex("api_keys", "prefix");
};

exports.down = (pgm) => {
  pgm.dropTable("api_keys");
};
