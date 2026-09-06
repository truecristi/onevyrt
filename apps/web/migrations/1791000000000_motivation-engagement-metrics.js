/**
 * Migration: Add motivation engagement metrics tables
 *
 * Created: 2026-09-03
 * Purpose: Track engagement with why/creed features and calculate cohort health scores
 *
 * Tables:
 * - motivation_engagement_events: Audit trail of all engagement actions
 * - engagement_metrics: Cached/materialized view for performance (refreshed daily)
 *
 * Events tracked:
 * - why_creed_viewed: User viewed their why/creed on dashboard
 * - why_creed_edited: User edited their why/creed
 * - reflection_started: User began a 90-day reflection
 * - reflection_completed: User completed a 90-day reflection
 * - email_sent: Motivation email sent (remember_why, ninety_days, etc.)
 * - email_opened: Email opened (tracked via pixel or link)
 * - email_clicked: Email link clicked (tracked via webhook)
 * - reminder_dismissed: User dismissed a motivation reminder
 */

exports.up = async (pgm) => {
  // Engagement events audit trail
  pgm.createTable("motivation_engagement_events", {
    id: {
      type: "text",
      primaryKey: true,
      comment: "Unique event ID (ev_<timestamp>_<random>)",
    },
    workspace_id: {
      type: "text",
      notNull: true,
      references: "workspaces(id)",
      onDelete: "CASCADE",
      comment: "Workspace context for the engagement event",
    },
    user_id: {
      type: "text",
      references: "users(id)",
      onDelete: "CASCADE",
      comment: "Optional user ID (null for anonymous/system events)",
    },
    user_email: {
      type: "varchar(255)",
      comment: "Email address if available (for tracking across accounts)",
    },
    event_type: {
      type: "varchar(50)",
      notNull: true,
      comment:
        "Event type: why_creed_viewed, why_creed_edited, reflection_completed, email_opened, etc.",
    },
    metadata: {
      type: "jsonb",
      comment:
        "Additional event data: email_template_id, reflection_type, feature_section, etc.",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
      comment: "When the event occurred",
    },
  });

  // Indexes for efficient querying
  pgm.createIndex("motivation_engagement_events", ["workspace_id", "created_at"], {
    name: "idx_motivation_events_workspace_date",
    comment: "Query events by workspace and date range",
  });

  pgm.createIndex("motivation_engagement_events", ["user_id", "event_type"], {
    name: "idx_motivation_events_user_type",
    comment: "Query events by user and event type",
  });

  pgm.createIndex("motivation_engagement_events", ["event_type", "created_at"], {
    name: "idx_motivation_events_type_date",
    comment: "Query events by type and date (for reporting)",
  });

  pgm.createIndex("motivation_engagement_events", ["workspace_id", "user_id"], {
    name: "idx_motivation_events_workspace_user",
    comment: "Query user events within workspace",
  });

  // Materialized engagement metrics (summary, refreshed daily)
  // This is a convenience table for fast cohort-level queries without aggregating raw events
  pgm.createTable("engagement_metrics", {
    id: {
      type: "text",
      primaryKey: true,
      comment: "Unique metric snapshot ID (em_<date>_<workspace>_<user>)",
    },
    workspace_id: {
      type: "text",
      notNull: true,
      references: "workspaces(id)",
      onDelete: "CASCADE",
      comment: "Workspace context",
    },
    user_id: {
      type: "text",
      references: "users(id)",
      onDelete: "CASCADE",
      comment: "User being measured",
    },
    period_start_date: {
      type: "date",
      notNull: true,
      comment: "Start of measurement period",
    },
    period_end_date: {
      type: "date",
      notNull: true,
      comment: "End of measurement period",
    },
    why_creed_view_count: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Number of times user viewed why/creed",
    },
    why_creed_edit_count: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Number of times user edited why/creed",
    },
    reflections_completed: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Number of 90-day reflections completed",
    },
    emails_sent: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Motivation emails sent to user",
    },
    emails_opened: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Emails opened by user",
    },
    emails_clicked: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Email links clicked by user",
    },
    email_open_rate: {
      type: "numeric(5, 2)",
      comment: "Open rate as decimal (0.0-1.0)",
    },
    email_click_rate: {
      type: "numeric(5, 2)",
      comment: "Click rate as decimal (0.0-1.0)",
    },
    engagement_score: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Composite engagement score (0-100)",
    },
    last_activity_at: {
      type: "timestamp",
      comment: "Last engagement event in this period",
    },
    snapshot_date: {
      type: "date",
      notNull: true,
      default: pgm.func("now()"),
      comment: "When this snapshot was created",
    },
    updated_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
      comment: "Last update to this record",
    },
  });

  // Indexes for metrics table
  pgm.createIndex("engagement_metrics", ["workspace_id", "period_end_date"], {
    name: "idx_engagement_metrics_workspace_period",
    comment: "Query metrics by workspace and period",
  });

  pgm.createIndex("engagement_metrics", ["user_id", "period_end_date"], {
    name: "idx_engagement_metrics_user_period",
    comment: "Query user metrics over time",
  });

  pgm.createIndex("engagement_metrics", ["engagement_score"], {
    name: "idx_engagement_metrics_score",
    comment: "Query by engagement score (for health snapshots)",
  });

  pgm.createIndex("engagement_metrics", ["snapshot_date"], {
    name: "idx_engagement_metrics_snapshot_date",
    comment: "Query by snapshot date (for cleanup/retention)",
  });

  // Cohort engagement summary (denormalized for fast queries)
  // Updated daily as part of the job tick
  pgm.createTable("cohort_engagement_summary", {
    id: {
      type: "text",
      primaryKey: true,
      comment: "Unique summary ID (ces_<date>_<cohort>)",
    },
    cohort_id: {
      type: "text",
      notNull: true,
      references: "cohorts(id)",
      onDelete: "CASCADE",
      comment: "The cohort being summarized",
    },
    total_learners: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Total member count in cohort",
    },
    active_learners_count: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Learners with engagement_score > 0",
    },
    active_learners_percent: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Percentage of learners active",
    },
    avg_engagement_score: {
      type: "numeric(5, 2)",
      notNull: true,
      default: 0,
      comment: "Mean engagement score across cohort",
    },
    median_engagement_score: {
      type: "numeric(5, 2)",
      notNull: true,
      default: 0,
      comment: "Median engagement score across cohort",
    },
    high_engagement_count: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Count with score > 75",
    },
    low_engagement_count: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Count with score < 40",
    },
    why_creed_completion_rate: {
      type: "numeric(3, 2)",
      comment: "Percentage with why/creed filled (0.0-1.0)",
    },
    reflection_completion_rate: {
      type: "numeric(3, 2)",
      comment: "Percentage with reflections completed (0.0-1.0)",
    },
    email_engagement_rate: {
      type: "numeric(3, 2)",
      comment: "Percentage with email engagement (0.0-1.0)",
    },
    summary_date: {
      type: "date",
      notNull: true,
      default: pgm.func("now()"),
      comment: "Date this summary was generated",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  // Indexes for cohort summary
  pgm.createIndex("cohort_engagement_summary", ["cohort_id", "summary_date"], {
    name: "idx_cohort_summary_cohort_date",
    comment: "Query summaries by cohort and date",
  });

  pgm.createIndex("cohort_engagement_summary", ["summary_date"], {
    name: "idx_cohort_summary_date",
    comment: "Query summaries by date (for latest snapshots)",
  });

  // Add a unique constraint on (cohort_id, summary_date) so we only have one summary per day
  pgm.createConstraint("cohort_engagement_summary", "uq_cohort_summary_per_date", {
    unique: ["cohort_id", "summary_date"],
  });
};

exports.down = async (pgm) => {
  pgm.dropTable("cohort_engagement_summary", { cascade: true, ifExists: true });
  pgm.dropTable("engagement_metrics", { cascade: true, ifExists: true });
  pgm.dropTable("motivation_engagement_events", { cascade: true, ifExists: true });
};
