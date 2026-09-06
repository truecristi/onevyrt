/**
 * Campaign Studio foundation, part 2: the "Brand Brain" — a persistent,
 * once-entered brand profile per workspace, so Campaign Studio (and later,
 * ads/landing-page/email generation) never has to ask the user to
 * re-explain their company. One row per workspace.
 */
exports.up = (pgm) => {
  pgm.createTable("brand_profiles", {
    workspace_id: { type: "text", primaryKey: true },
    website_url: { type: "text" },
    company_name: { type: "text" },
    industry: { type: "text" },
    description: { type: "text" },
    logo_url: { type: "text" },
    primary_color: { type: "text" },
    secondary_color: { type: "text" },
    language: { type: "text" },
    brand_voice: { type: "text" },
    prohibited_words: { type: "text[]", notNull: true, default: "{}" },
    products: { type: "jsonb", notNull: true, default: "[]" },
    audience: { type: "text" },
    competitors: { type: "text" },
    guarantees: { type: "text" },
    pricing_notes: { type: "text" },
    locations: { type: "text" },
    testimonials: { type: "jsonb", notNull: true, default: "[]" },
    created_at: { type: "timestamptz", notNull: true },
    updated_at: { type: "timestamptz", notNull: true },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("brand_profiles");
};
