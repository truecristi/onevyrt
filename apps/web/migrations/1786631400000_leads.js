/**
 * Leads inbox for the Acquisition OS. Every completed qualification funnel is
 * recorded as a lead (qualified / nurture / unqualified) so the owner can see
 * who came in, their score, route, and which ad they came from — the app's
 * side of the ad → qualify → book loop.
 *
 * Multi-tenant safety: a funnel is owned by a workspace via qual_funnel_owners.
 * A captured lead/booking is stamped with the owning workspace_id (NULL when
 * the funnel is unowned, e.g. the shared public demo), and the inbox only ever
 * returns rows for the viewer's own workspace — so one tenant never sees
 * another's leads. Claiming a funnel back-fills its previously-NULL rows.
 */
exports.up = (pgm) => {
  pgm.createTable("qual_funnel_owners", {
    slug: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("qual_funnel_owners", "workspace_id");

  pgm.createTable("leads", {
    id: { type: "text", primaryKey: true },
    funnel_slug: { type: "text", notNull: true },
    workspace_id: { type: "text" }, // NULL until the funnel is owned/claimed
    status: { type: "text", notNull: true }, // qualified | nurture | unqualified
    score: { type: "integer", notNull: true, default: 0 },
    route: { type: "text" },
    answers: { type: "jsonb" },
    attribution: { type: "jsonb" },
    name: { type: "text" },
    email: { type: "text" },
    phone: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("leads", ["workspace_id", "created_at"]);
  pgm.createIndex("leads", ["funnel_slug", "created_at"]);

  // Bookings gain the same workspace stamp so they scope to the inbox too.
  pgm.addColumn("bookings", { workspace_id: { type: "text" } });
  pgm.createIndex("bookings", ["workspace_id", "slot_start"]);
};

exports.down = (pgm) => {
  pgm.dropIndex("bookings", ["workspace_id", "slot_start"]);
  pgm.dropColumn("bookings", "workspace_id");
  pgm.dropTable("leads");
  pgm.dropTable("qual_funnel_owners");
};
