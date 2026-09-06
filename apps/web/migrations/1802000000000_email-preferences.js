/**
 * Add email_preferences table for workspace-scoped notification opt-outs.
 *
 * Users can opt out of:
 * - reminder_emails: reminder emails (e.g., "check in on your progress")
 * - weekly_digest: weekly digest emails (e.g., "here's your week in review")
 * - in_app_notifications: in-app notifications (bell icon)
 * - decision_moments: decision moment notifications (e.g., "time to review")
 *
 * All delivery systems (email, SMS, in-app) respect these preferences before sending.
 * Stored per-workspace with soft-delete support (deleted_at timestamp).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable(
    "email_preferences",
    {
      id: { type: "text", primaryKey: true },
      workspace_id: {
        type: "text",
        notNull: true,
        references: '"workspaces"(id)',
        onDelete: "cascade",
      },
      reminder_emails: {
        type: "boolean",
        default: true,
        notNull: true,
      },
      weekly_digest: {
        type: "boolean",
        default: true,
        notNull: true,
      },
      in_app_notifications: {
        type: "boolean",
        default: true,
        notNull: true,
      },
      decision_moments: {
        type: "boolean",
        default: true,
        notNull: true,
      },
      created_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("now()"),
      },
      updated_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("now()"),
      },
      deleted_at: "timestamp",
    },
    {
      constraints: {
        unique: [["workspace_id"]],
      },
    }
  );

  // Index on workspace_id for lookups
  pgm.createIndex("email_preferences", "workspace_id");

  // Index on deleted_at for soft-delete queries
  pgm.createIndex("email_preferences", "deleted_at");
};

exports.down = (pgm) => {
  pgm.dropTable("email_preferences");
};
