/**
 * Fourteenth migration: the three commercial programme offers (see
 * lib/programme-offers.ts). Exactly three fixed ids (self_paced, cohort,
 * premium_1to1), instance-wide, naturally per-row.
 */
exports.up = (pgm) => {
  pgm.createTable("programme_offers", {
    id: { type: "text", primaryKey: true },
    name: { type: "text", notNull: true },
    price_label: { type: "text", notNull: true },
    description: { type: "text", notNull: true },
    active: { type: "boolean", notNull: true, default: false },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("programme_offers");
};
