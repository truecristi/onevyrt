/**
 * Email-change confirmation: a pending change is parked here (keyed by a
 * hashed token) until the user clicks the verification link sent to the NEW
 * address. Only then does users.email actually change. Mirrors reset_tokens —
 * keyed by token hash, expiring, one active pending change per user. expires_at
 * stays bigint (epoch ms) to match the rest of lib/auth.ts.
 */
exports.up = (pgm) => {
  pgm.createTable("pending_email_changes", {
    token_hash: { type: "text", primaryKey: true },
    user_id: { type: "text", notNull: true },
    new_email_lower: { type: "text", notNull: true },
    expires_at: { type: "bigint", notNull: true },
  });
  pgm.createIndex("pending_email_changes", "user_id");
};

exports.down = (pgm) => {
  pgm.dropTable("pending_email_changes");
};
