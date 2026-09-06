/**
 * Funnel analytics events for the Acquisition OS. The lead/booking tables cover
 * the *bottom* of the funnel; this covers the top — a `view` when someone lands
 * on /q/[slug], a `start` when they begin answering — so conversion can be
 * measured all the way through: view → start → lead → qualified → verified →
 * booked. Stamped with the funnel's owning workspace (NULL when unowned), like
 * leads, so analytics scope per tenant. Also a tiny per-funnel ad-spend store
 * so cost-per-qualified-lead / cost-per-booking (CAC) can be shown.
 */
exports.up = (pgm) => {
  pgm.createTable("funnel_events", {
    id: { type: "text", primaryKey: true },
    funnel_slug: { type: "text", notNull: true },
    workspace_id: { type: "text" },
    type: { type: "text", notNull: true }, // view | start
    attribution: { type: "jsonb" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("funnel_events", ["workspace_id", "type"]);
  pgm.createIndex("funnel_events", ["funnel_slug", "type"]);

  pgm.createTable("funnel_spend", {
    funnel_slug: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    amount: { type: "numeric", notNull: true, default: 0 },
    currency: { type: "text", notNull: true, default: "USD" },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("funnel_spend");
  pgm.dropTable("funnel_events");
};
