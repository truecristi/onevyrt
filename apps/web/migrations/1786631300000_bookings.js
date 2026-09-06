/**
 * Bookings for the Acquisition OS: a qualified lead's chosen call slot. The
 * UNIQUE (funnel_slug, slot_start) constraint is the double-booking guard —
 * two visitors racing for the same slot: the second insert fails cleanly, same
 * pattern as the auth stores. slot_start is the "YYYY-MM-DDTHH:MM" wall-clock
 * key the availability engine produces; attribution rides along as jsonb so a
 * booking ties back to its ad.
 */
exports.up = (pgm) => {
  pgm.createTable("bookings", {
    id: { type: "text", primaryKey: true },
    funnel_slug: { type: "text", notNull: true },
    slot_start: { type: "text", notNull: true },
    name: { type: "text" },
    email: { type: "text" },
    phone: { type: "text" },
    attribution: { type: "jsonb" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("bookings", "bookings_slot_unique", { unique: ["funnel_slug", "slot_start"] });
  pgm.createIndex("bookings", ["funnel_slug", "slot_start"]);
};

exports.down = (pgm) => {
  pgm.dropTable("bookings");
};
