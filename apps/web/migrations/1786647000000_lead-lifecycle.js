/**
 * Lead lifecycle stage — the working-inbox state, separate from the funnel's
 * qualification verdict (leads.status = qualified | nurture | unqualified,
 * which is set once at submission and never changes). `lifecycle` is the
 * mutable follow-up stage the owner drives: new → contacted → booked → won,
 * with lost / nurture / unsubscribed as terminal branches (§322). Without it a
 * leads inbox is a reporting list, not a place you work.
 *
 * Existing leads back-fill to 'new' so nothing is silently marked handled.
 */
exports.up = (pgm) => {
  pgm.addColumn("leads", {
    lifecycle: { type: "text", notNull: true, default: "new" },
  });
  pgm.createIndex("leads", ["workspace_id", "lifecycle"]);
};

exports.down = (pgm) => {
  pgm.dropIndex("leads", ["workspace_id", "lifecycle"]);
  pgm.dropColumn("leads", "lifecycle");
};
