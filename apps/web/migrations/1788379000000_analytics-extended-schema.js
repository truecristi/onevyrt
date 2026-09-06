/**
 * Extended analytics schema for comprehensive event tracking:
 * - page_views: Track all page navigation
 * - user_actions: Track user interactions (clicks, form submissions, etc.)
 * - conversion_events: Track business conversions (chapter complete, plan approved)
 * - analytics_errors: Track client-side and server-side errors
 * - performance_metrics: Track performance data (page load time, API latency)
 * - privacy_settings: User privacy preferences (DNT, tracking consent, GDPR)
 */
exports.up = (pgm) => {
  // Page views tracking
  pgm.createTable("page_views", {
    id: { type: "text", primaryKey: true },
    user_id: { type: "text" },
    workspace_id: { type: "text" },
    page_path: { type: "text", notNull: true },
    page_title: { type: "text" },
    referrer: { type: "text" },
    session_id: { type: "text" },
    user_agent: { type: "text" },
    country: { type: "text" },
    metadata: { type: "jsonb" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("page_views", ["created_at"]);
  pgm.createIndex("page_views", ["user_id", "created_at"]);
  pgm.createIndex("page_views", ["workspace_id", "created_at"]);
  pgm.createIndex("page_views", ["page_path", "created_at"]);
  pgm.createIndex("page_views", "session_id");

  // User actions tracking
  pgm.createTable("user_actions", {
    id: { type: "text", primaryKey: true },
    user_id: { type: "text" },
    workspace_id: { type: "text" },
    action_type: { type: "text", notNull: true }, // e.g., 'button_click', 'form_submit', 'file_upload'
    action_name: { type: "text", notNull: true }, // e.g., 'submit_chapter', 'approve_submission'
    page_path: { type: "text" },
    session_id: { type: "text" },
    value: { type: "numeric" }, // For tracked values (e.g., form field input, amount)
    duration_ms: { type: "integer" }, // Time spent on action (e.g., form fill time)
    metadata: { type: "jsonb" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("user_actions", ["created_at"]);
  pgm.createIndex("user_actions", ["user_id", "created_at"]);
  pgm.createIndex("user_actions", ["workspace_id", "created_at"]);
  pgm.createIndex("user_actions", ["action_type", "created_at"]);
  pgm.createIndex("user_actions", "session_id");

  // Conversion events (business outcomes)
  pgm.createTable("conversion_events", {
    id: { type: "text", primaryKey: true },
    user_id: { type: "text" },
    workspace_id: { type: "text" },
    conversion_type: { type: "text", notNull: true }, // e.g., 'chapter_completed', 'plan_approved', 'document_exported'
    conversion_name: { type: "text", notNull: true },
    revenue_value: { type: "numeric" }, // For monetized conversions
    currency: { type: "text" }, // e.g., 'USD'
    session_id: { type: "text" },
    source_page: { type: "text" },
    funnel_stage: { type: "text" }, // e.g., 'awareness', 'consideration', 'decision', 'retention'
    metadata: { type: "jsonb" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("conversion_events", ["created_at"]);
  pgm.createIndex("conversion_events", ["user_id", "created_at"]);
  pgm.createIndex("conversion_events", ["workspace_id", "created_at"]);
  pgm.createIndex("conversion_events", ["conversion_type", "created_at"]);
  pgm.createIndex("conversion_events", "session_id");

  // Error tracking
  pgm.createTable("analytics_errors", {
    id: { type: "text", primaryKey: true },
    user_id: { type: "text" },
    workspace_id: { type: "text" },
    error_type: { type: "text", notNull: true }, // e.g., 'client_error', 'server_error', 'network_error'
    error_message: { type: "text", notNull: true },
    error_code: { type: "text" },
    error_stack: { type: "text" },
    page_path: { type: "text" },
    session_id: { type: "text" },
    user_agent: { type: "text" },
    context: { type: "jsonb" }, // Error context data
    severity: { type: "text", default: "error" }, // 'info', 'warning', 'error', 'critical'
    resolved: { type: "boolean", default: false },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("analytics_errors", ["created_at"]);
  pgm.createIndex("analytics_errors", ["user_id", "created_at"]);
  pgm.createIndex("analytics_errors", ["error_type", "created_at"]);
  pgm.createIndex("analytics_errors", "session_id");

  // Performance metrics
  pgm.createTable("performance_metrics", {
    id: { type: "text", primaryKey: true },
    user_id: { type: "text" },
    workspace_id: { type: "text" },
    metric_type: { type: "text", notNull: true }, // e.g., 'page_load', 'api_latency', 'database_query'
    metric_name: { type: "text", notNull: true }, // e.g., 'chapter_page_load', 'submit_chapter_api'
    value_ms: { type: "integer", notNull: true }, // Milliseconds
    page_path: { type: "text" },
    api_endpoint: { type: "text" },
    session_id: { type: "text" },
    metadata: { type: "jsonb" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("performance_metrics", ["created_at"]);
  pgm.createIndex("performance_metrics", ["metric_type", "created_at"]);
  pgm.createIndex("performance_metrics", ["metric_name", "created_at"]);

  // Privacy settings
  pgm.createTable("privacy_settings", {
    user_id: { type: "text", primaryKey: true },
    workspace_id: { type: "text" },
    do_not_track: { type: "boolean", default: false },
    tracking_consent: { type: "boolean", default: true },
    analytics_enabled: { type: "boolean", default: true },
    marketing_emails: { type: "boolean", default: true },
    product_emails: { type: "boolean", default: true },
    gdpr_ackowledged: { type: "boolean", default: false },
    data_retention_days: { type: "integer", default: 90 }, // How long to keep analytics data
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("privacy_settings", "workspace_id");
};

exports.down = (pgm) => {
  pgm.dropTable("privacy_settings", { ifExists: true });
  pgm.dropTable("performance_metrics", { ifExists: true });
  pgm.dropTable("analytics_errors", { ifExists: true });
  pgm.dropTable("conversion_events", { ifExists: true });
  pgm.dropTable("user_actions", { ifExists: true });
  pgm.dropTable("page_views", { ifExists: true });
};
