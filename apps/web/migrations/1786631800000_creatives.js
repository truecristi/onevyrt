/**
 * Saved ad creatives for the Creative Loop. A generated variant the owner
 * decides to run is saved here with its creative_id — the same id its tracked
 * funnel link carries (?creative_id=…), which every lead/booking records in its
 * attribution. That shared key is what lets us join a creative to the real
 * leads / qualified / booked it produced, turning the AI's *predicted* score
 * into *actual* performance. creative_id is unique per workspace so the join is
 * unambiguous.
 */
exports.up = (pgm) => {
  pgm.createTable("creatives", {
    id: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    funnel_slug: { type: "text", notNull: true },
    creative_id: { type: "text", notNull: true },
    angle: { type: "text" },
    headline: { type: "text", notNull: true },
    primary_text: { type: "text" },
    cta: { type: "text" },
    score: { type: "integer", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("creatives", "creatives_ws_cid_unique", { unique: ["workspace_id", "creative_id"] });
  pgm.createIndex("creatives", ["workspace_id", "created_at"]);
};

exports.down = (pgm) => {
  pgm.dropTable("creatives");
};
