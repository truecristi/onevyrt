/**
 * Seventh migration: the three remaining small stores in lib/auth.ts —
 * login_guard (brute-force lockout counters), reset_tokens (password reset),
 * pending_2fa (post-password, pre-code login tokens). All keyed/expiring,
 * naturally per-row, targeted SQL. expires_at/locked_until stay bigint
 * (epoch ms) rather than timestamptz since the calling code already compares
 * them directly against Date.now(), same reasoning as sessions.expiresAt.
 */
exports.up = (pgm) => {
  pgm.createTable("login_guard", {
    email: { type: "text", primaryKey: true },
    fails: { type: "integer", notNull: true, default: 0 },
    locked_until: { type: "bigint", notNull: true, default: 0 },
  });

  pgm.createTable("reset_tokens", {
    token_hash: { type: "text", primaryKey: true },
    email_lower: { type: "text", notNull: true },
    expires_at: { type: "bigint", notNull: true },
  });
  pgm.createIndex("reset_tokens", "email_lower");

  pgm.createTable("pending_2fa", {
    token_hash: { type: "text", primaryKey: true },
    user_id: { type: "text", notNull: true },
    expires_at: { type: "bigint", notNull: true },
    attempts: { type: "integer", notNull: true, default: 0 },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("pending_2fa");
  pgm.dropTable("reset_tokens");
  pgm.dropTable("login_guard");
};
