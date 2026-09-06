/**
 * Email queue table for storing and processing transactional emails.
 * Supports retry logic, scheduling, and template rendering.
 *
 * Tables:
 *  - email_queue: Stores pending, sent, and failed emails with full template data
 */

exports.up = (pgm) => {
  pgm.createTable("email_queue", {
    id: { type: "text", primaryKey: true },
    template_id: { type: "text", notNull: true },
    to_email: { type: "text", notNull: true },
    recipient_name: { type: "text" },
    data: { type: "jsonb", notNull: true },
    status: {
      type: "text",
      notNull: true,
      default: "pending",
      check: `status IN ('pending', 'sent', 'failed')`,
    },
    error: { type: "text" },
    sent_at: { type: "timestamp" },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("now()") },
    scheduled_for: { type: "timestamp" },
    retries: { type: "integer", notNull: true, default: 0 },
    last_retry_at: { type: "timestamp" },
  });

  // Indexes for common queries
  pgm.createIndex("email_queue", ["status", "scheduled_for"]);
  pgm.createIndex("email_queue", ["created_at"], { order: "DESC" });
  pgm.createIndex("email_queue", ["to_email"]);
  pgm.createIndex("email_queue", ["template_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("email_queue");
};
