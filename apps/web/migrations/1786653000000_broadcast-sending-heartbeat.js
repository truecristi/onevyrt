/**
 * Un-strand broadcasts stuck mid-send.
 *
 * dispatchDueBroadcasts claims a scheduled broadcast by flipping it to
 * 'sending', then delivers and flips it to 'sent'. If the process dies between
 * those two steps (container reclaimed, crash, deploy), the row is left in
 * 'sending' forever: the due-scan only picks up 'scheduled', so nothing ever
 * finalises it and its delivery log looks permanently in-flight.
 *
 * updated_at is a heartbeat stamped on every status transition. A reclaim pass
 * finds rows stuck in 'sending' well past a send's worst-case runtime and
 * finalises them from the broadcast_sends rows already written — WITHOUT
 * re-delivering, so recipients who already received it are never messaged
 * twice. The partial index keeps that reclaim scan cheap.
 *
 * Existing rows default to now(); they're already terminal, so they won't be
 * reclaimed.
 */
exports.up = (pgm) => {
  pgm.addColumn("broadcasts", {
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("broadcasts", "updated_at", {
    name: "broadcasts_sending_idx",
    where: "status = 'sending'",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("broadcasts", "updated_at", { name: "broadcasts_sending_idx" });
  pgm.dropColumn("broadcasts", "updated_at");
};
