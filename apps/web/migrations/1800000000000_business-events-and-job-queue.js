/**
 * Business Events & Async Job Queue for Why & Creed Webhook System
 *
 * Tables:
 * 1. business_events — Log of all high-impact business events (payment, milestone, level-up)
 *    - Used for analytics, weekly digest aggregation, and decision moment tracking
 *    - Deduped by business_event_dedupe_key to ensure idempotency
 *
 * 2. job_queue — Lightweight async task queue for notification delivery
 *    - send_decision_moment: Deliver notification + email for event
 *    - retry_count: Auto-retry up to 3x on transient failures
 *    - Picked up by scheduled job (api/cron/tick)
 *
 * Retention:
 * - business_events: kept for 90 days (audit + analytics)
 * - job_queue: deleted after completion + 7 days (transient task log)
 */

exports.up = (pgm) => {
  /**
   * business_events — Event log for analytics & digest
   */
  pgm.createTable("business_events", {
    id: { type: "text", primaryKey: true },
    workspace_id: {
      type: "text",
      notNull: true,
      references: "workspaces(id)",
      onDelete: "cascade",
    },
    user_id: {
      type: "text",
      notNull: true,
      references: "users(id)",
      onDelete: "cascade",
    },
    event_type: {
      type: "text",
      notNull: true,
      comment:
        "payment_processed | milestone_reached | level_up | daily_action | constraint_improved | habit_reset",
    },
    metadata: {
      type: "jsonb",
      notNull: true,
      default: "{}",
      comment:
        "Event-specific data: amount, currency, stripeChargeId, milestoneType, chapterId, etc.",
    },
    decision_moment: {
      type: "jsonb",
      comment:
        "Generated messaging: title, body, why, creed, actionUrl, urgencyLevel",
    },
    dedupe_key: {
      type: "text",
      unique: true,
      comment: "event:type:workspaceId:stripeChargeId or milestoneType+value",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
    },
    deleted_at: { type: "timestamp" },
  });

  pgm.createIndex("business_events", ["workspace_id", "created_at"], {
    name: "business_events_workspace_created",
  });
  pgm.createIndex("business_events", ["event_type", "created_at"], {
    name: "business_events_type_created",
  });
  pgm.createIndex("business_events", ["user_id", "created_at"], {
    name: "business_events_user_created",
  });

  /**
   * job_queue — Async task queue for decision moment notifications
   */
  pgm.createTable("job_queue", {
    id: { type: "text", primaryKey: true },
    job_type: {
      type: "text",
      notNull: true,
      comment:
        "send_decision_moment | send_weekly_digest | update_analytics",
    },
    payload: {
      type: "jsonb",
      notNull: true,
      comment:
        "Job-specific data: eventId, userId, userEmail, decisionMoment, urgencyLevel, etc.",
    },
    status: {
      type: "text",
      notNull: true,
      default: "pending",
      comment: "pending | processing | completed | failed",
    },
    error_message: {
      type: "text",
      comment: "Error details if status=failed",
    },
    retry_count: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Max 3 retries before failing",
    },
    next_retry_at: {
      type: "timestamp",
      comment: "Exponential backoff: now + (5 * retry_count) minutes",
    },
    completed_at: { type: "timestamp" },
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
    deleted_at: { type: "timestamp" },
  });

  pgm.createIndex("job_queue", ["status", "next_retry_at"], {
    name: "job_queue_status_retry",
  });
  pgm.createIndex("job_queue", ["job_type", "status"], {
    name: "job_queue_type_status",
  });
  pgm.createIndex("job_queue", "created_at", {
    name: "job_queue_created",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("job_queue", "job_queue_status_retry");
  pgm.dropIndex("job_queue", "job_queue_type_status");
  pgm.dropIndex("job_queue", "job_queue_created");
  pgm.dropTable("job_queue");

  pgm.dropIndex("business_events", "business_events_workspace_created");
  pgm.dropIndex("business_events", "business_events_type_created");
  pgm.dropIndex("business_events", "business_events_user_created");
  pgm.dropTable("business_events");
};
