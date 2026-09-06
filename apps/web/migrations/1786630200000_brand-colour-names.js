/**
 * Campaign Studio brand-profile enrichments:
 *  - primary/secondary colour NAMES ("Brand blue", "Ink") alongside the hex,
 *    so generated creatives can refer to colours the way the brand talks.
 *  - positioning gut-check: "what business are you in?" (surface) vs "what
 *    business are you REALLY in?" (the deeper outcome customers actually buy).
 *    Foundational context every downstream generator benefits from.
 * All nullable text on the existing brand_profiles row — no data migration.
 */
exports.up = (pgm) => {
  pgm.addColumns("brand_profiles", {
    primary_color_name: { type: "text" },
    secondary_color_name: { type: "text" },
    business_in: { type: "text" },
    business_really_in: { type: "text" },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns("brand_profiles", ["primary_color_name", "secondary_color_name", "business_in", "business_really_in"]);
};
