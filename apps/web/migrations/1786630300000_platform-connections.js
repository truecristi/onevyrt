/**
 * Campaign Studio: connected ad/social accounts. One row per (workspace,
 * provider). This is the registry + status the "Advertise" screen reads.
 *
 * Deliberately holds NO OAuth tokens yet: a real Meta/Google/TikTok
 * connection needs that platform's developer app + API approval (obtained by
 * the workspace owner, not us), and until that exists there are no tokens to
 * store. When live OAuth lands, encrypted token columns get added alongside —
 * this table is the shape those slot into. For now it records which accounts
 * a workspace has linked and their status, so the UI reflects real state
 * rather than a hardcoded "not connected".
 */
exports.up = (pgm) => {
  pgm.createTable("platform_connections", {
    workspace_id: { type: "text", notNull: true },
    provider: { type: "text", notNull: true },
    account_name: { type: "text", notNull: true },
    account_id: { type: "text" },
    status: { type: "text", notNull: true, default: "connected" },
    connected_at: { type: "timestamptz", notNull: true },
    updated_at: { type: "timestamptz", notNull: true },
  });
  pgm.addConstraint("platform_connections", "platform_connections_pkey", { primaryKey: ["workspace_id", "provider"] });
  pgm.createIndex("platform_connections", "workspace_id");
};

exports.down = (pgm) => {
  pgm.dropTable("platform_connections");
};
