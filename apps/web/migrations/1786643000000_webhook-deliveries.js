/**
 * Delivery history for outbound webhooks. The outbound_webhooks row only keeps
 * the LAST delivery's status (last_status/last_error) — enough for the status
 * pill, but not enough to answer "was it failing all week or just once?". This
 * table records one row per delivery attempt so the UI can show a real log.
 *
 * History is capped per webhook (see lib/webhooks.ts) so it can't grow without
 * bound; a bigserial id gives cheap recent-first ordering and a stable prune
 * key. Rows are deleted with their webhook (best-effort, in deleteWebhook).
 */
exports.up = (pgm) => {
  pgm.createTable("webhook_deliveries", {
    id: { type: "bigserial", primaryKey: true },
    webhook_id: { type: "text", notNull: true },
    workspace_id: { type: "text", notNull: true },
    event: { type: "text", notNull: true },
    status: { type: "integer" }, // HTTP status; null when the request never completed (timeout/DNS)
    ok: { type: "boolean", notNull: true },
    error: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  // Recent-first listing per webhook, and the prune query's lookup, both ride this.
  pgm.createIndex("webhook_deliveries", [{ name: "webhook_id" }, { name: "id", sort: "DESC" }]);
};

exports.down = (pgm) => {
  pgm.dropTable("webhook_deliveries");
};
