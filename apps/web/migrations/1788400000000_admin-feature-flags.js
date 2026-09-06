/**
 * Admin feature flags table - enable/disable features per workspace or globally
 */
exports.up = (pgm) => {
  pgm.createTable("admin_feature_flags", {
    id: { type: "text", primaryKey: true },
    workspace_id: { type: "text" },
    flag_name: { type: "text", notNull: true },
    enabled: { type: "boolean", notNull: true, default: false },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_by_email: { type: "text" },
    metadata: { type: "jsonb" },
  });

  pgm.createIndex("admin_feature_flags", ["flag_name", "workspace_id"], { unique: false });
  pgm.createIndex("admin_feature_flags", ["workspace_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("admin_feature_flags");
};
