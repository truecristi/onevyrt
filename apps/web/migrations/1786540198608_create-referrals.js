/**
 * Eighth migration: the referral program (see lib/referrals.ts). Two
 * stores, each already naturally per-row: referral_codes (code <->
 * workspace, one per workspace) and referrals (the growing log of who
 * referred whom). referred_workspace_id gets a real unique constraint —
 * the file version only enforced "no duplicate referral for the same
 * referred workspace" via an in-process check; Postgres can guarantee it
 * atomically instead.
 */
exports.up = (pgm) => {
  pgm.createTable("referral_codes", {
    code: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
  });
  pgm.createIndex("referral_codes", "workspace_id");

  pgm.createTable("referrals", {
    id: { type: "text", primaryKey: true },
    code: { type: "text", notNull: true },
    referrer_workspace_id: { type: "text", notNull: true },
    referred_workspace_id: { type: "text", notNull: true, unique: true },
    referred_user_id: { type: "text", notNull: true },
    status: { type: "text", notNull: true },
    created_at: { type: "text", notNull: true },
    qualified_at: { type: "text" },
    referred_plan_price_cents: { type: "integer" },
    referred_plan_currency: { type: "text" },
  });
  pgm.createIndex("referrals", "referrer_workspace_id");
};

exports.down = (pgm) => {
  pgm.dropTable("referrals");
  pgm.dropTable("referral_codes");
};
