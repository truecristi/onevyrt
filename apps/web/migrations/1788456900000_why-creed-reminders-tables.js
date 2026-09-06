/**
 * Migration: Add email_history and user_email_preferences tables
 *
 * Created: 2026-09-03
 * Purpose: Support why/creed reminder emails with deduplication and opt-out tracking
 */

exports.up = async (pgm) => {
  // Email history table: tracks all why/creed reminder sends
  pgm.createTable("email_history", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    workspace_id: {
      type: "text",
      notNull: true,
      references: "workspaces(id)",
      onDelete: "cascade",
    },
    user_id: {
      type: "text",
      references: "users(id)",
      onDelete: "cascade",
    },
    user_email: { type: "varchar(255)", notNull: true },
    template_type: {
      type: "varchar(50)",
      notNull: true,
      comment: "remember_why, ninety_days, creed_in_action, etc.",
    },
    dedupe_key: {
      type: "varchar(255)",
      notNull: true,
      unique: true,
      comment: "why_creed_email:workspace_id:template_type:date",
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "pending",
      comment: "pending, sent, failed, bounced",
    },
    message_id: { type: "varchar(255)" },
    error_message: { type: "text" },
    sent_at: { type: "timestamp", notNull: true, default: pgm.func("now()") },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("now()") },
  });

  // Indexes for email_history
  pgm.createIndex("email_history", ["workspace_id", "sent_at"], {
    name: "idx_email_history_workspace_date",
  });
  pgm.createIndex("email_history", ["dedupe_key"], {
    name: "idx_email_history_dedupe_key",
  });
  pgm.createIndex("email_history", ["user_email"], {
    name: "idx_email_history_user_email",
  });
  pgm.createIndex("email_history", ["status"], {
    name: "idx_email_history_status",
  });

  // User email preferences table: tracks opt-outs
  pgm.createTable("user_email_preferences", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "text",
      notNull: true,
      unique: true,
      references: "users(id)",
      onDelete: "cascade",
    },
    workspace_id: {
      type: "text",
      references: "workspaces(id)",
      onDelete: "cascade",
    },
    opted_out_all: {
      type: "boolean",
      notNull: true,
      default: false,
      comment: "User has opted out of all emails",
    },
    opted_out_from: {
      type: "jsonb",
      notNull: true,
      default: "{}",
      comment: "List of specific email types to opt out from",
    },
    updated_at: { type: "timestamp", notNull: true, default: pgm.func("now()") },
  });

  // Indexes for user_email_preferences
  pgm.createIndex("user_email_preferences", ["user_id"], {
    name: "idx_user_email_prefs_user_id",
  });
  pgm.createIndex("user_email_preferences", ["workspace_id"], {
    name: "idx_user_email_prefs_workspace_id",
  });

  // Email bounce log table (optional, for handling bounces)
  pgm.createTable("email_bounces", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_email: { type: "varchar(255)", notNull: true, unique: true },
    bounce_type: {
      type: "varchar(20)",
      notNull: true,
      comment: "hard, soft, complaint",
    },
    bounce_subtype: { type: "varchar(50)" },
    bounce_message: { type: "text" },
    permanently_opted_out: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    bounced_at: { type: "timestamp", notNull: true },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("email_bounces", ["user_email"], {
    name: "idx_email_bounces_email",
  });
  pgm.createIndex("email_bounces", ["bounce_type"], {
    name: "idx_email_bounces_type",
  });
};

exports.down = async (pgm) => {
  pgm.dropTable("email_bounces", { ifExists: true });
  pgm.dropTable("user_email_preferences", { ifExists: true });
  pgm.dropTable("email_history", { ifExists: true });
};
