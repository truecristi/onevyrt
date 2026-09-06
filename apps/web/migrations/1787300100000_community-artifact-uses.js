/**
 * Dedupe table for the community "uses" popularity counters (shared_creatives
 * .uses, shared_templates.uses). Before this, recordCreativeUse /
 * recordTemplateUse did a plain `uses = uses + 1` with no bound — unlike
 * community_reactions, which correctly has a composite primary key
 * (artifact_type, artifact_id, workspace_id) so a workspace can't react
 * twice. That meant an artifact's own author could loop-call its "use"
 * endpoint (across many rate-limit windows, over time) and inflate its own
 * popularity indefinitely.
 *
 * This table mirrors community_reactions's composite-key pattern: one row
 * per (artifact_type, artifact_id, workspace_id) that has used that
 * artifact. recordCreativeUse/recordTemplateUse now INSERT ... ON CONFLICT
 * DO NOTHING here first, and only bump the counter when that insert actually
 * added a new row — so a given workspace counts toward "uses" at most once
 * per artifact, no matter how many times it calls the endpoint.
 *
 * No secondary index: every access here is a point lookup/insert on the full
 * (artifact_type, artifact_id, workspace_id) triple, which the primary key
 * already serves — unlike community_reactions, nothing here needs an
 * aggregate "count by artifact" query (the running total lives denormalized
 * on shared_creatives.uses / shared_templates.uses instead).
 */
exports.up = (pgm) => {
  pgm.createTable("community_artifact_uses", {
    artifact_type: { type: "text", notNull: true }, // 'template' | 'creative'
    artifact_id: { type: "text", notNull: true },
    workspace_id: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, { constraints: { primaryKey: ["artifact_type", "artifact_id", "workspace_id"] } });
};

exports.down = (pgm) => {
  pgm.dropTable("community_artifact_uses");
};
