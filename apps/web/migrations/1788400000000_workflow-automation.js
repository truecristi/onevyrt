/**
 * Workflow automation and batch operations.
 *
 * workflows: Define automation rules with triggers, conditions, and actions
 * workflow_executions: Track execution history and results
 * workflow_runs: Last-run tracking for schedule-based workflows
 * batch_operations: Queue for bulk operations (user invites, approvals, resets)
 *
 * Trigger types:
 *   - chapter_submitted: When a learner submits a chapter
 *   - lesson_submitted: When a learner submits a lesson
 *   - submission_reviewed: When a coach reviews a submission
 *   - schedule: Time-based (daily, weekly, monthly)
 *   - manual: Triggered via API
 *
 * Actions:
 *   - send_email: Send email to learner/coach/workspace
 *   - send_notification: Create in-app notification
 *   - auto_approve: Auto-approve if conditions met
 *   - auto_archive: Archive old projects
 *   - bulk_invite: Invite multiple users
 *   - bulk_reset: Reset learner progress
 */
exports.up = (pgm) => {
  pgm.createTable("workflows", {
    id: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    name: { type: "text", notNull: true },
    description: { type: "text" },
    enabled: { type: "boolean", notNull: true, default: true },
    trigger_type: { type: "text", notNull: true }, // chapter_submitted, schedule, etc.
    trigger_config: { type: "jsonb", notNull: true, default: "{}" }, // schedule expression, chapter_id, etc.
    conditions: { type: "jsonb", notNull: true, default: "[]" }, // [{field, operator, value}]
    actions: { type: "jsonb", notNull: true, default: "[]" }, // [{type, config}]
    created_by_user_id: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("workflows", ["workspace_id", "enabled"]);

  pgm.createTable("workflow_executions", {
    id: { type: "text", primaryKey: true },
    workflow_id: { type: "text", notNull: true, references: "workflows(id)" },
    workspace_id: { type: "text", notNull: true },
    triggered_at: { type: "timestamptz", notNull: true },
    trigger_data: { type: "jsonb" }, // The event that triggered this
    status: { type: "text", notNull: true, default: "pending" }, // pending, processing, success, failed
    error_message: { type: "text" },
    action_results: { type: "jsonb", default: "[]" }, // [{action_index, status, result}]
    executed_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("workflow_executions", ["workflow_id", "status"]);
  pgm.createIndex("workflow_executions", ["workspace_id", "created_at"]);

  pgm.createTable("workflow_runs", {
    workflow_id: { type: "text", primaryKey: true, references: "workflows(id)" },
    last_run_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("batch_operations", {
    id: { type: "text", primaryKey: true },
    workspace_id: { type: "text", notNull: true },
    operation_type: { type: "text", notNull: true }, // bulk_invite, bulk_approval, bulk_reset
    status: { type: "text", notNull: true, default: "pending" }, // pending, processing, success, failed
    total_items: { type: "integer", notNull: true, default: 0 },
    processed_items: { type: "integer", notNull: true, default: 0 },
    failed_items: { type: "integer", notNull: true, default: 0 },
    operation_data: { type: "jsonb", notNull: true }, // emails[], chapter_id, etc.
    results: { type: "jsonb", default: "[]" }, // [{item, status, result}]
    error_message: { type: "text" },
    started_at: { type: "timestamptz" },
    completed_at: { type: "timestamptz" },
    created_by_user_id: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("batch_operations", ["workspace_id", "status"]);
  pgm.createIndex("batch_operations", ["workspace_id", "created_at"]);
};

exports.down = (pgm) => {
  pgm.dropTable("batch_operations");
  pgm.dropTable("workflow_runs");
  pgm.dropTable("workflow_executions");
  pgm.dropTable("workflows");
};
