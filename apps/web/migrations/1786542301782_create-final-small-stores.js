/**
 * Sixteenth migration: the last three file-based stores. audit_log (was a
 * capped array file, insert-then-trim like activity/comments).
 * instance_settings (a true singleton — one fixed row, `id = true`, unique
 * by construction). stripe_events (the webhook idempotency/history log,
 * inline in app/api/webhooks/stripe/route.ts — same capped-array shape as
 * audit_log). onboarding.ts is a pure function with no storage and needs
 * no migration.
 */
exports.up = (pgm) => {
  pgm.createTable("audit_log", {
    id: { type: "text", primaryKey: true },
    at: { type: "timestamptz", notNull: true },
    actor_email: { type: "text", notNull: true },
    action: { type: "text", notNull: true },
    target_type: { type: "text" },
    target_label: { type: "text" },
    detail: { type: "text" },
  });
  pgm.createIndex("audit_log", "at");

  pgm.createTable("instance_settings", {
    id: { type: "boolean", primaryKey: true, default: true },
    public_origin: { type: "text", notNull: true, default: "" },
  });
  pgm.addConstraint("instance_settings", "instance_settings_singleton", { check: "id = true" });

  pgm.createTable("stripe_events", {
    id: { type: "text", primaryKey: true },
    type: { type: "text", notNull: true },
    received_at: { type: "timestamptz", notNull: true },
    amount_total: { type: "integer" },
    currency: { type: "text" },
    customer_email: { type: "text" },
  });
  pgm.createIndex("stripe_events", "received_at");
};

exports.down = (pgm) => {
  pgm.dropTable("stripe_events");
  pgm.dropTable("instance_settings");
  pgm.dropTable("audit_log");
};
