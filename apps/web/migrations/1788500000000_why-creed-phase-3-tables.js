/**
 * Migration: Why & Creed Phase 3 — Reflection History, Email Preferences, Motivation Analytics
 *
 * Adds:
 * - reflection_history: 90-day checkpoint tracking with entries per reflection cycle
 * - notification_preferences: User opt-out & notification frequency control
 * - motivation_analytics: Engagement metrics (views, edits, shares, sentiment)
 *
 * Extends workspace_why_creed with engagement tracking:
 * - last_reflected_at: timestamp of most recent reflection entry
 * - reflection_count: cumulative reflections taken
 * - streak_days: current consecutive days of weekly reflections
 */

exports.up = (pgm) => {
  // 1. Extend workspace_why_creed with engagement columns
  pgm.addColumns('workspace_why_creed', {
    last_reflected_at: {
      type: 'timestamp',
      notNull: false,
      default: null,
      comment: 'Timestamp of most recent reflection checkpoint',
    },
    reflection_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Cumulative count of reflection entries recorded',
    },
    streak_days: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Current consecutive weeks of active reflection (0–52)',
    },
  });

  // 2. Create reflection_history table
  // Tracks 90-day checkpoints: workspace reviews their why/creed every ~30 days
  pgm.createTable('reflection_history', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    workspace_id: {
      type: 'text',
      notNull: true,
      references: 'workspaces(id)',
      onDelete: 'cascade',
      comment: 'Reference to workspace',
    },
    reflection_cycle: {
      type: 'integer',
      notNull: true,
      comment: 'Cycle number (0=initial, 1=day30, 2=day60, 3=day90, etc.)',
    },
    snapshot_why: {
      type: 'text',
      notNull: true,
      default: '',
      comment: 'Why value at time of reflection',
    },
    snapshot_creed: {
      type: 'text',
      notNull: true,
      default: '',
      comment: 'Creed value at time of reflection',
    },
    reflection_notes: {
      type: 'text',
      notNull: false,
      default: null,
      comment: 'Optional notes from user reflection (what changed, lessons)',
    },
    sentiment: {
      type: 'varchar(20)',
      notNull: true,
      default: 'neutral',
      check: `sentiment IN ('very_negative', 'negative', 'neutral', 'positive', 'very_positive')`,
      comment: 'Engagement sentiment: how is the user feeling?',
    },
    progress_rating: {
      type: 'integer',
      notNull: false,
      default: null,
      check: 'progress_rating IS NULL OR (progress_rating >= 1 AND progress_rating <= 10)',
      comment: 'User self-rated progress on why/creed goals (1–10 scale)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
    deleted_at: {
      type: 'timestamp',
      notNull: false,
      default: null,
      comment: 'Soft-delete timestamp',
    },
  }, {
    comment: '90-day reflection checkpoints: workspace snapshots & sentiment tracking',
  });

  // 3. Create notification_preferences table
  // User opt-out & notification frequency control
  pgm.createTable('notification_preferences', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    workspace_id: {
      type: 'text',
      notNull: true,
      references: 'workspaces(id)',
      onDelete: 'cascade',
      comment: 'Reference to workspace (shared across workspace users)',
    },
    reflection_reminders: {
      type: 'boolean',
      notNull: true,
      default: true,
      comment: 'Send 90-day reflection checkpoint reminders',
    },
    motivation_digest: {
      type: 'boolean',
      notNull: true,
      default: true,
      comment: 'Send weekly motivation digest (why/creed energy + progress)',
    },
    coaching_updates: {
      type: 'boolean',
      notNull: true,
      default: true,
      comment: 'Send coaching-related notifications (approvals, feedback)',
    },
    programme_milestones: {
      type: 'boolean',
      notNull: true,
      default: true,
      comment: 'Send chapter completion & progression milestones',
    },
    digest_frequency: {
      type: 'varchar(20)',
      notNull: true,
      default: 'weekly',
      check: `digest_frequency IN ('daily', 'weekly', 'biweekly', 'monthly')`,
      comment: 'Frequency of motivation digest',
    },
    unsubscribe_all: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Master opt-out: disables all emails (except critical)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
  }, {
    comment: 'Email notification preferences & opt-out per workspace',
  });

  // 4. Create motivation_analytics table
  // Engagement metrics: views, edits, shares, sentiment over time
  pgm.createTable('motivation_analytics', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    workspace_id: {
      type: 'text',
      notNull: true,
      references: 'workspaces(id)',
      onDelete: 'cascade',
      comment: 'Reference to workspace',
    },
    metric_date: {
      type: 'date',
      notNull: true,
      comment: 'Date of metric capture (aggregated daily)',
    },
    why_creed_views: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Daily count of why/creed section views (dashboard opens)',
    },
    why_edits: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Edits to why field',
    },
    creed_edits: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Edits to creed field',
    },
    shares_via_email: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Count of emails sent sharing why/creed insights',
    },
    reflection_entries: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Reflection history entries created today',
    },
    avg_sentiment: {
      type: 'numeric(2,1)',
      notNull: false,
      default: null,
      comment: 'Average sentiment score across daily reflections (1–5)',
    },
    engagement_score: {
      type: 'numeric(4,2)',
      notNull: true,
      default: 0,
      comment: 'Computed engagement score (0–100): reflects active use of why/creed',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
  }, {
    comment: 'Daily engagement analytics: views, edits, shares, sentiment aggregation',
  });

  // 5. Create indices for query optimization

  // reflection_history indices
  pgm.createIndex('reflection_history', ['workspace_id', 'created_at'], {
    name: 'idx_reflection_history_workspace_created',
    comment: 'Fast lookup of reflections by workspace + time',
  });
  pgm.createIndex('reflection_history', ['workspace_id', 'reflection_cycle'], {
    name: 'idx_reflection_history_workspace_cycle',
    comment: 'Lookup current cycle for a workspace',
  });
  pgm.createIndex('reflection_history', ['deleted_at'], {
    name: 'idx_reflection_history_deleted_at',
    where: 'deleted_at IS NULL',
    comment: 'Filter active reflections (soft-delete)',
  });

  // notification_preferences indices
  pgm.createIndex('notification_preferences', ['workspace_id'], {
    unique: true,
    name: 'idx_notification_preferences_workspace_id',
    comment: 'Enforce one prefs record per workspace, fast lookup',
  });

  // motivation_analytics indices
  pgm.createIndex('motivation_analytics', ['workspace_id', 'metric_date'], {
    name: 'idx_motivation_analytics_workspace_date',
    comment: 'Daily metric queries by workspace',
  });
  pgm.createIndex('motivation_analytics', ['metric_date'], {
    name: 'idx_motivation_analytics_metric_date',
    comment: 'Global rollup queries by date',
  });
  pgm.createIndex('motivation_analytics', ['engagement_score'], {
    name: 'idx_motivation_analytics_engagement',
    comment: 'Find high/low engagement workspaces for targeted outreach',
  });

  // workspace_why_creed indices (new columns)
  pgm.createIndex('workspace_why_creed', ['last_reflected_at'], {
    name: 'idx_why_creed_last_reflected',
    comment: 'Find workspaces needing reflection reminders',
  });
  pgm.createIndex('workspace_why_creed', ['streak_days'], {
    name: 'idx_why_creed_streak',
    comment: 'Identify high-engagement streaks for recognition',
  });
};

exports.down = (pgm) => {
  // Drop indices
  pgm.dropIndex('motivation_analytics', 'idx_motivation_analytics_engagement', {
    ifExists: true,
  });
  pgm.dropIndex('motivation_analytics', 'idx_motivation_analytics_metric_date', {
    ifExists: true,
  });
  pgm.dropIndex('motivation_analytics', 'idx_motivation_analytics_workspace_date', {
    ifExists: true,
  });
  pgm.dropIndex('notification_preferences', 'idx_notification_preferences_workspace_id', {
    ifExists: true,
  });
  pgm.dropIndex('reflection_history', 'idx_reflection_history_deleted_at', {
    ifExists: true,
  });
  pgm.dropIndex('reflection_history', 'idx_reflection_history_workspace_cycle', {
    ifExists: true,
  });
  pgm.dropIndex('reflection_history', 'idx_reflection_history_workspace_created', {
    ifExists: true,
  });
  pgm.dropIndex('workspace_why_creed', 'idx_why_creed_streak', {
    ifExists: true,
  });
  pgm.dropIndex('workspace_why_creed', 'idx_why_creed_last_reflected', {
    ifExists: true,
  });

  // Drop tables
  pgm.dropTable('motivation_analytics', { ifExists: true });
  pgm.dropTable('notification_preferences', { ifExists: true });
  pgm.dropTable('reflection_history', { ifExists: true });

  // Drop added columns from workspace_why_creed
  pgm.dropColumns('workspace_why_creed', [
    'last_reflected_at',
    'reflection_count',
    'streak_days',
  ]);
};
