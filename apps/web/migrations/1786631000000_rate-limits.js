/**
 * Scalability: a shared rate-limit store so limits hold across every app
 * instance, not just within one Node process. The in-memory limiter
 * (lib/rate-limit.ts) counts per-container, so N containers behind a load
 * balancer effectively multiply every limit by N — fine for one box, wrong
 * once you scale horizontally (see RUNBOOK). One fixed-window counter row per
 * key; reset_at is epoch-millis so the app can compare against Date.now().
 */
exports.up = (pgm) => {
  pgm.createTable("rate_limits", {
    key: { type: "text", primaryKey: true },
    count: { type: "integer", notNull: true, default: 0 },
    reset_at: { type: "bigint", notNull: true },
  });
  // Lets the opportunistic cleanup delete expired rows by range efficiently.
  pgm.createIndex("rate_limits", "reset_at", { name: "rate_limits_reset_at" });
};

exports.down = (pgm) => {
  pgm.dropTable("rate_limits");
};
