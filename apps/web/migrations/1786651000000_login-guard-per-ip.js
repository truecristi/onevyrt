/**
 * Make the login lockout non-weaponizable — key it by (email, ip), not email.
 *
 * The DoS: the lockout counter was keyed on email alone, so anyone could lock a
 * VICTIM out of their own account just by failing the password 5 times for the
 * victim's email — the real owner was then refused for 15 minutes, from their
 * own browser. That turns a brute-force defence into a griefing tool.
 *
 * Keying the counter by (email, ip) fixes it: 5 wrong tries from the attacker's
 * IP lock only that IP's attempts on that email; the owner, on a different IP,
 * has a separate (zeroed) counter and logs in normally. Brute-forcing one email
 * from one IP is still stopped, and one IP cycling many emails is separately
 * capped by the route's per-IP rate limit (app/api/auth/login). A successful
 * login clears every IP's counter for that email (clearLoginFailures).
 *
 * Existing rows get ip='' (a harmless legacy bucket); they're transient counters
 * that expire on their own.
 */
exports.up = (pgm) => {
  pgm.addColumn("login_guard", { ip: { type: "text", notNull: true, default: "" } });
  pgm.dropConstraint("login_guard", "login_guard_pkey");
  pgm.addConstraint("login_guard", "login_guard_pkey", { primaryKey: ["email", "ip"] });
};

exports.down = (pgm) => {
  // Collapse back to one row per email before restoring the single-column PK:
  // keep each email's most-locked row (highest locked_until, then ip) and drop
  // the rest, so the narrower primary key can't be violated by duplicates.
  pgm.sql(
    "DELETE FROM login_guard a USING login_guard b " +
    "WHERE a.email = b.email AND a.ip <> b.ip AND (a.locked_until, a.ip) < (b.locked_until, b.ip)",
  );
  pgm.dropConstraint("login_guard", "login_guard_pkey");
  pgm.addConstraint("login_guard", "login_guard_pkey", { primaryKey: ["email"] });
  pgm.dropColumn("login_guard", "ip");
};
