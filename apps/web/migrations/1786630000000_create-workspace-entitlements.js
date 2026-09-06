/**
 * Campaign Studio foundation, part 1: add-on entitlements. Deliberately NOT
 * a fixed set of boolean columns on `workspaces` — every future paid module
 * (CRM, automation, white-label, ...) just becomes another row here instead
 * of another migration. Plan-INCLUDED entitlements (e.g. Performance tier
 * including Campaign Studio) are computed from workspaces.plan at read time
 * (see lib/entitlements.ts), not stored here — this table only records
 * entitlements a workspace explicitly bought as an add-on, so there's one
 * source of truth for "why does this workspace have this" instead of two
 * that can drift out of sync.
 */
exports.up = (pgm) => {
  pgm.createTable("workspace_entitlements", {
    workspace_id: { type: "text", notNull: true },
    entitlement: { type: "text", notNull: true },
    status: { type: "text", notNull: true, default: "active" },
    stripe_subscription_item_id: { type: "text" },
    granted_at: { type: "timestamptz", notNull: true },
    updated_at: { type: "timestamptz", notNull: true },
  });
  pgm.addConstraint("workspace_entitlements", "workspace_entitlements_pkey", {
    primaryKey: ["workspace_id", "entitlement"],
  });
  pgm.createIndex("workspace_entitlements", "workspace_id");
};

exports.down = (pgm) => {
  pgm.dropTable("workspace_entitlements");
};
