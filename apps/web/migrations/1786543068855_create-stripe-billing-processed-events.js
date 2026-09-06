/**
 * Nineteenth migrated domain, found on a post-migration sweep: the billing
 * webhook's own idempotency log (app/api/webhooks/stripe-billing/route.ts),
 * distinct from stripe_events (the marketing/tracking webhook's log this
 * app receives on a USER's behalf) — this one guards against Stripe
 * redelivering a plan-change event and double-appending an audit-log entry.
 * Was a capped id-array file, naturally per-row, insert-then-trim.
 */
exports.up = (pgm) => {
  pgm.createTable("stripe_billing_processed_events", {
    id: { type: "text", primaryKey: true },
    processed_at: { type: "timestamptz", notNull: true },
  });
  pgm.createIndex("stripe_billing_processed_events", "processed_at");
};

exports.down = (pgm) => {
  pgm.dropTable("stripe_billing_processed_events");
};
