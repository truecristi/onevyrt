/**
 * Second migration in the JSON-file -> Postgres move: the `users` table,
 * mirroring lib/auth.ts's StoredUser shape exactly (see .gearbox/users.json
 * today). Unlike sessions, `users` is read-modify-write as a WHOLE ARRAY
 * throughout lib/auth.ts (register/disable/purge/password/email/avatar/2FA
 * all follow that shape, each already serialized through the same in-process
 * file lock) — so the Postgres side of readUsers/writeUsers preserves that
 * exact contract (full read, full transactional sync on write) instead of
 * rewriting every call site to targeted SQL. That keeps 100% of the existing,
 * tested business logic in lib/auth.ts untouched by this migration.
 */
exports.up = (pgm) => {
  pgm.createTable("users", {
    id: { type: "text", primaryKey: true },
    email: { type: "text", notNull: true, unique: true },
    created_at: { type: "timestamptz", notNull: true },
    pass: { type: "text", notNull: true },
    disabled: { type: "boolean", notNull: true, default: false },
    avatar_url: { type: "text" },
    twofa_pending_secret: { type: "text" },
    twofa_secret: { type: "text" },
    twofa_enabled: { type: "boolean", notNull: true, default: false },
    twofa_backup_hashes: { type: "text[]" },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("users");
};
