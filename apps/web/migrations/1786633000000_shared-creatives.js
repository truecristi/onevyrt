/**
 * Community swipe file — shared ad creatives. An owner can publish one of their
 * ad creatives (headline, primary text, CTA, angle) to a public swipe file any
 * other workspace can browse and copy. Second shared-artifact layer of the
 * community/expansion direction, after shared funnel templates. Stores the ad
 * copy only — no leads, no attribution, no funnel link. `uses` counts copies.
 */
exports.up = (pgm) => {
  pgm.createTable("shared_creatives", {
    id: { type: "text", primaryKey: true },
    author_workspace_id: { type: "text", notNull: true },
    headline: { type: "text", notNull: true },
    primary_text: { type: "text" },
    cta: { type: "text" },
    angle: { type: "text" },
    score: { type: "integer", notNull: true, default: 0 },
    uses: { type: "integer", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("shared_creatives", ["created_at"]);
  pgm.createIndex("shared_creatives", ["author_workspace_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("shared_creatives");
};
