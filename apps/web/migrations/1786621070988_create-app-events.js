/**
 * Twenty-first domain: internal product analytics — usage of the OneVYRT
 * app itself (signups, logins, workspaces created, plan upgrades), not to
 * be confused with the customer-funnel tracking OneVYRT provides TO its
 * users (see lib/tracking.ts, tracking_* tables) — that's a product
 * feature; this is operational insight for running the business. One
 * append-only event per row, deliberately unbounded (unlike the capped
 * audit-log/stripe-events tables) since this is meant to answer "how has
 * usage trended" questions that need real history, not just recent state.
 */
exports.up = (pgm) => {
  pgm.createTable("app_events", {
    id: { type: "text", primaryKey: true },
    name: { type: "text", notNull: true },
    user_id: { type: "text" },
    workspace_id: { type: "text" },
    metadata: { type: "jsonb" },
    created_at: { type: "timestamptz", notNull: true },
  });
  pgm.createIndex("app_events", ["name", "created_at"]);
  pgm.createIndex("app_events", "created_at");
};

exports.down = (pgm) => {
  pgm.dropTable("app_events");
};
