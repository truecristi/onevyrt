/**
 * Campaign Studio: the brand's core message, stored as a small jsonb object
 * on the brand_profiles row (hero / problem / guide / plan / call-to-action /
 * success / failure / one-liner — the seven-part story structure plus a
 * summary). Downstream generators read it so every message keeps the customer
 * the hero and the brand the guide. Nullable; defaults to an empty object.
 */
exports.up = (pgm) => {
  pgm.addColumns("brand_profiles", {
    message: { type: "jsonb", notNull: true, default: "{}" },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns("brand_profiles", ["message"]);
};
