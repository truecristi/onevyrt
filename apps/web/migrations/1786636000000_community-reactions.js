/**
 * Community reactions — a lightweight "helpful" endorsement (👍) on a shared
 * artifact, distinct from a copy: a copy is intent, a reaction is a vote that
 * the thing actually worked. One reaction per workspace per artifact (the
 * primary key enforces it), so the count is a real headcount of endorsers.
 * No PII — just which workspace endorsed which artifact.
 */
exports.up = (pgm) => {
  pgm.createTable("community_reactions", {
    artifact_type: { type: "text", notNull: true }, // 'template' | 'creative'
    artifact_id: { type: "text", notNull: true },
    workspace_id: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, { constraints: { primaryKey: ["artifact_type", "artifact_id", "workspace_id"] } });
  pgm.createIndex("community_reactions", ["artifact_type", "artifact_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("community_reactions");
};
