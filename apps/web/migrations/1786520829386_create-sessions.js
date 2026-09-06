/**
 * Pilot migration: the `sessions` table, mirroring lib/auth.ts's
 * SessionRecord shape exactly (see .gearbox/sessions.json today). Chosen as
 * the first domain to move because it's append-mostly, self-contained (no
 * foreign keys into anything else that's also mid-migration), and easy to
 * verify by comparing "active sessions" counts against the JSON file during
 * cutover. user_id is left as plain text, not a foreign key, because `users`
 * itself hasn't moved to Postgres yet — added once it has.
 */
exports.up = (pgm) => {
  pgm.createTable("sessions", {
    id: { type: "text", primaryKey: true },
    user_id: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true },
    last_seen_at: { type: "timestamptz", notNull: true },
    user_agent: { type: "text" },
    expires_at: { type: "timestamptz", notNull: true },
    revoked: { type: "boolean", notNull: true, default: false },
  });
  pgm.createIndex("sessions", "user_id");
  pgm.createIndex("sessions", "expires_at");
};

exports.down = (pgm) => {
  pgm.dropTable("sessions");
};
