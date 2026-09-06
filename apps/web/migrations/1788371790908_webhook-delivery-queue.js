/**
 * Retry queue + dead-letter store for OUTBOUND webhook delivery.
 *
 * This is a different table from the existing outbound-webhook machinery
 * (see lib/webhooks.ts):
 *   - outbound_webhooks   — a workspace's registered destination + secret
 *   - webhook_deliveries  — a capped, read-only LOG of past attempts (for the
 *                           delivery-history UI); dispatchEvent() fires each
 *                           event exactly once, best-effort, and never retries
 *
 * webhook_delivery_queue is the missing piece: an actual retry mechanism.
 * Each row is one delivery *to be attempted* (or re-attempted) — enqueued by
 * lib/webhooks/retry-queue.ts's enqueueWebhook(), worked off by its
 * processRetryQueue() on exponential backoff, and moved to 'dead_letter'
 * once it has failed MAX_ATTEMPTS times. It's deliberately generic
 * (event_type/payload/target_url as plain columns, not a foreign key to
 * outbound_webhooks) so both Stripe-triggered and custom outbound webhooks
 * can enqueue into it — wiring dispatchEvent()/Stripe events through this
 * queue instead of firing inline is Wave 4's job-tick integration; this
 * migration and its lib module are the standalone foundation for that.
 *
 * status is a plain text column (no CHECK), same convention as
 * broadcasts.status and leads.lifecycle elsewhere in this schema:
 *   pending     — queued, waiting for next_retry_at (attempt_count may be 0
 *                 for a delivery that hasn't been tried yet, or >0 for one
 *                 that failed and is waiting out its backoff)
 *   processing  — claimed by a worker mid-delivery attempt
 *   delivered   — succeeded; terminal
 *   dead_letter — exhausted MAX_ATTEMPTS; terminal until an admin manually
 *                 retries it (see retryDeadLetteredWebhook)
 *
 * The (status, next_retry_at) index is what makes "give me due pending rows"
 * a cheap poll rather than a table scan. The partial index on updated_at
 * backs a reclaim pass for rows stuck in 'processing' because a container
 * died mid-attempt — same shape as broadcasts_sending_idx
 * (1786653000000_broadcast-sending-heartbeat.js).
 */
exports.up = (pgm) => {
  pgm.createTable("webhook_delivery_queue", {
    id: { type: "bigserial", primaryKey: true },
    event_type: { type: "text", notNull: true },
    payload: { type: "jsonb", notNull: true },
    target_url: { type: "text", notNull: true },
    attempt_count: { type: "integer", notNull: true, default: 0 },
    next_retry_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    failed_at: { type: "timestamptz" }, // stamped when moved to dead_letter
    status: { type: "text", notNull: true, default: "pending" },
    // Columns beyond the minimum, same spirit as webhook_deliveries.error /
    // last_status: enough for the admin view to say *why* something is stuck.
    delivered_at: { type: "timestamptz" },
    last_error: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }, // heartbeat; see reclaim index below
  });

  pgm.createIndex("webhook_delivery_queue", ["status", "next_retry_at"]);
  pgm.createIndex("webhook_delivery_queue", "updated_at", {
    name: "webhook_delivery_queue_processing_idx",
    where: "status = 'processing'",
  });
};

exports.down = (pgm) => {
  pgm.dropTable("webhook_delivery_queue");
};
