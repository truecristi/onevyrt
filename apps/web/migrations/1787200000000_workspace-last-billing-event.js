/**
 * Event-ordering guard for OneVYRT's own billing webhook
 * (app/api/webhooks/stripe-billing/route.ts).
 *
 * Stripe does not guarantee delivery order and redelivers on retries, so a
 * late, OLDER event — e.g. a stale "canceled" arriving after a newer "active" —
 * could otherwise clobber a paying workspace back down to free. This records
 * the `created` timestamp (Stripe events carry it as epoch seconds) of the last
 * billing event actually applied to each workspace; the handler applies an
 * event only when its `created` is >= this high-water mark, and bumps the mark
 * atomically in the same UPDATE that sets the plan (so concurrent deliveries
 * can't interleave).
 *
 * bigint, matching Stripe's own epoch-seconds representation — an exact integer
 * comparison, no timezone/rounding subtlety. Nullable: a workspace that has
 * never had a billing event applied has no mark, and the very first event (any
 * `created`) applies and sets it. Read/written only by workspace id (the
 * primary key), so no extra index is needed.
 */
exports.up = (pgm) => {
  pgm.addColumn("workspaces", {
    last_billing_event_at: { type: "bigint" },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("workspaces", "last_billing_event_at");
};
