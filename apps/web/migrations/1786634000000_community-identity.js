/**
 * Community identity — a public display name a workspace shares under, plus a
 * denormalized snapshot of that name on every shared artifact so listings show
 * "Shared by <name>" without a join. This is the credit layer of the community
 * direction: attribution turns an anonymous download shelf into a place with
 * people in it. The profile name is the only new stored identity — no email or
 * PII is exposed; the default is derived from the email handle at publish time.
 */
exports.up = (pgm) => {
  pgm.createTable("community_profiles", {
    workspace_id: { type: "text", primaryKey: true },
    display_name: { type: "text", notNull: true },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addColumn("shared_templates", { author_name: { type: "text" } });
  pgm.addColumn("shared_creatives", { author_name: { type: "text" } });
};

exports.down = (pgm) => {
  pgm.dropColumn("shared_templates", "author_name");
  pgm.dropColumn("shared_creatives", "author_name");
  pgm.dropTable("community_profiles");
};
