/**
 * Data Management System v1: Export history, scheduled exports, import tracking,
 * backup records, and data retention policies.
 *
 * Tables added:
 * - export_history: Tracks all exports (JSON/CSV/PDF), selective vs full, user/workspace
 * - scheduled_exports: Configuration for recurring exports (daily/weekly/monthly)
 * - import_history: Tracks all imports (users, funnels, learners), status, counts
 * - backup_records: Automated daily backups, point-in-time recovery metadata
 * - data_retention_policies: Soft-delete window durations per data type, compliance settings
 *
 * All tied to workspace_id (multi-tenant), with soft-delete support where appropriate.
 */

exports.up = (pgm) => {
  // Export history: tracks every export (manual or scheduled)
  pgm.createTable("export_history", {
    id: { type: "text", primaryKey: true }, // uuid v7
    workspace_id: { type: "text", notNull: true },
    user_id: { type: "text", notNull: true },
    format: { type: "text", notNull: true, check: "format IN ('json', 'csv', 'pdf')" },
    export_type: { type: "text", notNull: true, check: "export_type IN ('full', 'selective')" },
    // For selective exports: JSON array of selected categories
    // e.g. ["projects", "enrollment", "activity", "invoices"]
    selected_categories: { type: "jsonb", default: "{}" },
    file_size_bytes: { type: "bigint", notNull: true },
    file_url: { type: "text" }, // S3 or similar CDN URL
    status: { type: "text", notNull: true, default: "completed", check: "status IN ('pending', 'processing', 'completed', 'failed')" },
    error_message: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    expires_at: { type: "timestamptz" }, // When the file can be deleted (e.g., 30 days)
  });
  pgm.createIndex("export_history", ["workspace_id", "created_at"], { name: "export_history_workspace_date_idx" });
  pgm.createIndex("export_history", ["user_id", "created_at"], { name: "export_history_user_date_idx" });
  pgm.createIndex("export_history", ["status"], { name: "export_history_status_idx" });

  // Scheduled exports: recurring export tasks
  pgm.createTable("scheduled_exports", {
    id: { type: "text", primaryKey: true }, // uuid v7
    workspace_id: { type: "text", notNull: true },
    created_by_user_id: { type: "text", notNull: true },
    name: { type: "text", notNull: true },
    format: { type: "text", notNull: true, check: "format IN ('json', 'csv', 'pdf')" },
    selected_categories: { type: "jsonb", notNull: true },
    frequency: { type: "text", notNull: true, check: "frequency IN ('daily', 'weekly', 'monthly')" },
    // For weekly: 0=Monday-6=Sunday; for monthly: 1-28 (day of month)
    schedule_day_or_weekday: { type: "integer" },
    schedule_hour: { type: "integer", default: 0 }, // 0-23 UTC
    recipient_email: { type: "text", notNull: true },
    enabled: { type: "boolean", notNull: true, default: true },
    last_run_at: { type: "timestamptz" },
    next_run_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    deleted_at: { type: "timestamptz" },
  });
  pgm.createIndex("scheduled_exports", ["workspace_id", "enabled"], { name: "scheduled_exports_active_idx" });
  pgm.createIndex("scheduled_exports", ["next_run_at"], { name: "scheduled_exports_next_run_idx" });

  // Import history: tracks all imports (users, funnels, learners)
  pgm.createTable("import_history", {
    id: { type: "text", primaryKey: true }, // uuid v7
    workspace_id: { type: "text", notNull: true },
    user_id: { type: "text", notNull: true },
    import_type: { type: "text", notNull: true, check: "import_type IN ('users', 'funnels', 'learners')" },
    file_name: { type: "text", notNull: true },
    file_size_bytes: { type: "bigint", notNull: true },
    status: { type: "text", notNull: true, default: "pending", check: "status IN ('pending', 'processing', 'completed', 'failed')" },
    // Counts of what was imported
    total_rows: { type: "integer", notNull: true },
    successfully_imported: { type: "integer", default: 0 },
    skipped_rows: { type: "integer", default: 0 },
    failed_rows: { type: "integer", default: 0 },
    // Error details: JSON array of { row_number, field, error_message }
    error_details: { type: "jsonb", default: "[]" },
    mapping_config: { type: "jsonb" }, // Column mapping config for CSV
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    completed_at: { type: "timestamptz" },
  });
  pgm.createIndex("import_history", ["workspace_id", "created_at"], { name: "import_history_workspace_date_idx" });
  pgm.createIndex("import_history", ["status"], { name: "import_history_status_idx" });

  // Backup records: automated backup metadata for point-in-time recovery
  pgm.createTable("backup_records", {
    id: { type: "text", primaryKey: true }, // uuid v7
    workspace_id: { type: "text", notNull: true },
    backup_type: { type: "text", notNull: true, default: "automated", check: "backup_type IN ('automated', 'manual')" },
    backup_timestamp: { type: "timestamptz", notNull: true }, // The point-in-time the backup represents
    storage_location: { type: "text", notNull: true }, // S3 bucket/path or similar
    storage_size_bytes: { type: "bigint", notNull: true },
    status: { type: "text", notNull: true, default: "completed", check: "status IN ('pending', 'processing', 'completed', 'failed')" },
    includes_media: { type: "boolean", default: false },
    checksum: { type: "text" }, // SHA256 for integrity verification
    retention_until: { type: "timestamptz" }, // When this backup can be deleted
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    error_message: { type: "text" },
  });
  pgm.createIndex("backup_records", ["workspace_id", "backup_timestamp"], { name: "backup_records_workspace_time_idx" });
  pgm.createIndex("backup_records", ["retention_until"], { name: "backup_records_retention_idx" });

  // Data retention policies: compliance configuration per data type
  pgm.createTable("data_retention_policies", {
    id: { type: "text", primaryKey: true }, // uuid v7
    workspace_id: { type: "text", notNull: true },
    data_type: { type: "text", notNull: true },
    // e.g., "leads", "projects", "activity_logs", "events", "bookings"
    soft_delete_days: { type: "integer", notNull: true }, // Days before hard-delete is allowed
    hard_delete_days: { type: "integer", notNull: true }, // Days until automatic hard-delete
    auto_delete_enabled: { type: "boolean", notNull: true, default: true },
    compliance_note: { type: "text" }, // e.g., "GDPR compliance", "Industry regulation"
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("data_retention_policies", ["workspace_id", "data_type"], {
    name: "data_retention_policies_workspace_type_idx",
    unique: true,
  });

  // Compliance reports: snapshot of what was deleted/retained
  pgm.createTable("compliance_reports", {
    id: { type: "text", primaryKey: true }, // uuid v7
    workspace_id: { type: "text", notNull: true },
    report_date: { type: "date", notNull: true },
    data_type: { type: "text", notNull: true },
    records_kept: { type: "bigint", notNull: true, default: 0 },
    records_soft_deleted: { type: "bigint", notNull: true, default: 0 },
    records_hard_deleted: { type: "bigint", notNull: true, default: 0 },
    total_storage_bytes: { type: "bigint", notNull: true, default: 0 },
    compliance_status: { type: "text", default: "compliant" }, // "compliant", "at_risk", "non_compliant"
    notes: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("compliance_reports", ["workspace_id", "report_date"], { name: "compliance_reports_workspace_date_idx" });
};

exports.down = (pgm) => {
  pgm.dropTable("compliance_reports");
  pgm.dropTable("data_retention_policies");
  pgm.dropTable("backup_records");
  pgm.dropTable("import_history");
  pgm.dropTable("scheduled_exports");
  pgm.dropTable("export_history");
};
