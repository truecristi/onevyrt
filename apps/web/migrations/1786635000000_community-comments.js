/**
 * Community comments — a discussion thread on each shared artifact (a funnel
 * template or a swipe-file creative). This turns the hub from a download shelf
 * into a conversation: owners can say what worked, what they changed, what to
 * watch for. Each comment carries a snapshot of the author's community display
 * name (same credit model as the artifacts). Body only — no PII.
 */
exports.up = (pgm) => {
  pgm.createTable("community_comments", {
    id: { type: "text", primaryKey: true },
    artifact_type: { type: "text", notNull: true }, // 'template' | 'creative'
    artifact_id: { type: "text", notNull: true },
    author_workspace_id: { type: "text", notNull: true },
    author_name: { type: "text" },
    body: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("community_comments", ["artifact_type", "artifact_id", "created_at"]);
  pgm.createIndex("community_comments", ["author_workspace_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("community_comments");
};
