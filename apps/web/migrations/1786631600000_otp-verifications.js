/**
 * Contact verification (OTP) for the Acquisition OS. Before a qualified lead
 * reaches the calendar, they prove they own the email/phone they gave — a
 * one-time code, hashed at rest, short expiry, capped attempts. This is the
 * "verified contact" gate the flywheel wants: bookings go to reachable people,
 * and Meta learns from verified leads, not throwaway details. `leads.verified`
 * flags which leads cleared it, for the inbox.
 */
exports.up = (pgm) => {
  pgm.createTable("otp_verifications", {
    id: { type: "text", primaryKey: true },
    funnel_slug: { type: "text", notNull: true },
    channel: { type: "text", notNull: true }, // email | sms
    destination: { type: "text", notNull: true }, // the email or phone being verified
    code_hash: { type: "text", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
    attempts: { type: "integer", notNull: true, default: 0 },
    verified_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("otp_verifications", ["funnel_slug", "created_at"]);

  pgm.addColumn("leads", { verified: { type: "boolean", notNull: true, default: false } });
};

exports.down = (pgm) => {
  pgm.dropColumn("leads", "verified");
  pgm.dropTable("otp_verifications");
};
