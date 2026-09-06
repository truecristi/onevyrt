/**
 * Scheduled broadcasts. Until now a broadcast sent inline the moment it was
 * composed (status draft → sending → sent). This adds a scheduled_at column so
 * a broadcast can be queued for a future time: it's stored with status
 * 'scheduled', and the jobs engine (lib/jobs.ts, ticked by /api/cron/tick)
 * dispatches it once its time has passed — atomically flipping 'scheduled' →
 * 'sending' so a double-tick can never send it twice. 'cancelled' is a
 * terminal state for a scheduled broadcast the owner called off before it ran.
 *
 * status now spans: draft | scheduled | sending | sent | cancelled (text, so no
 * enum change needed). The partial index keeps the due-scan cheap even as sent
 * history grows, since it only holds rows still waiting to fire.
 */
exports.up = (pgm) => {
  pgm.addColumn("broadcasts", {
    scheduled_at: { type: "timestamptz" }, // null for send-now broadcasts
  });
  pgm.createIndex("broadcasts", "scheduled_at", {
    name: "broadcasts_due_idx",
    where: "status = 'scheduled'",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("broadcasts", "scheduled_at", { name: "broadcasts_due_idx" });
  pgm.dropColumn("broadcasts", "scheduled_at");
};
