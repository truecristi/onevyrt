/**
 * Durable per-workspace revenue ledger — a running total that the 500-event
 * cap can't erode.
 *
 * "Total collected" was summed on the fly from stripe_events, which is a capped
 * recent-activity log (MAX_EVENTS_PER_WS): once a workspace passed the cap, its
 * oldest completed sales were evicted and the headline total silently shrank.
 * This table accumulates gross and refunded amounts per (workspace, currency)
 * as events arrive, so the figure is cumulative and eviction-proof. It's also
 * where refunds are netted out of revenue (charge.refunded → refunded_cents).
 *
 * Keyed by (workspace_id, currency) because money in different currencies can't
 * be added — each currency carries its own running totals. Amounts are in the
 * currency's minor units (cents), matching Stripe's amount_total.
 *
 * Backfill: seed gross + sale_count from the completed sales still present in
 * stripe_events. Refunds are NOT backfilled (historical refund events weren't
 * captured with amounts); they net out from here forward.
 */
exports.up = (pgm) => {
  pgm.createTable("workspace_revenue", {
    workspace_id: { type: "text", notNull: true },
    currency: { type: "text", notNull: true, default: "" },
    gross_cents: { type: "bigint", notNull: true, default: 0 },
    refunded_cents: { type: "bigint", notNull: true, default: 0 },
    sale_count: { type: "integer", notNull: true, default: 0 },
    refund_count: { type: "integer", notNull: true, default: 0 },
  });
  pgm.addConstraint("workspace_revenue", "workspace_revenue_pkey", { primaryKey: ["workspace_id", "currency"] });

  pgm.sql(
    "INSERT INTO workspace_revenue (workspace_id, currency, gross_cents, sale_count) " +
    "SELECT workspace_id, lower(coalesce(currency, '')), sum(amount_total)::bigint, count(*)::int " +
    "FROM stripe_events " +
    "WHERE workspace_id IS NOT NULL AND amount_total IS NOT NULL " +
    "AND type IN ('checkout.session.completed', 'onevyrt.funnel.paid') " +
    "GROUP BY workspace_id, lower(coalesce(currency, '')) " +
    "ON CONFLICT (workspace_id, currency) DO NOTHING",
  );
};

exports.down = (pgm) => {
  pgm.dropTable("workspace_revenue");
};
