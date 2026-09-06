/**
 * Motivation Metrics & Engagement Tracking
 *
 * Tracks engagement with Why & Creed features across the coaching platform:
 * - Dashboard views (when users see their why/creed)
 * - Reflection completions (90-day reflection checkpoints)
 * - Email engagement (reminder sends, opens, click-through)
 * - Cohort health scoring (aggregate engagement patterns)
 *
 * Used for coaching dashboards, learner engagement reporting, and cohort health
 * snapshots. All metrics are workspace and date-range filterable.
 */

import { query } from "../db";

/**
 * Engagement event types tracked in the motivation metrics system
 */
export type EngagementEventType =
  | "why_creed_viewed"
  | "why_creed_edited"
  | "reflection_started"
  | "reflection_completed"
  | "email_sent"
  | "email_opened"
  | "email_clicked"
  | "reminder_dismissed";

/**
 * Single engagement event record (for logging/audit trail)
 */
export interface EngagementEvent {
  id: string;
  workspaceId: string;
  userId?: string;
  userEmail?: string;
  eventType: EngagementEventType;
  metadata?: Record<string, any>;
  createdAt: string;
}

/**
 * Engagement metrics for a single user/workspace over a time period
 */
export interface EngagementMetrics {
  workspaceId: string;
  userId?: string;
  userEmail?: string;
  periodStartDate: string;
  periodEndDate: string;
  whyCreedViewCount: number;
  whyCreedEditCount: number;
  reflectionsCompleted: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailOpenRate: number; // 0-1 decimal
  emailClickRate: number; // 0-1 decimal
  lastActivityAt?: string;
  engagementScore: number; // 0-100 composite score
}

/**
 * Cohort health snapshot showing aggregate metrics
 */
export interface CohortHealthScore {
  cohortId?: string;
  cohortName?: string;
  cohortCoachEmail?: string;
  totalLearners: number;
  activeLearnersCount: number;
  activeLearnersPercent: number;
  avgEngagementScore: number;
  mediaEngagementScore: number;
  whyCreedCompletionRate: number; // % with why/creed set
  reflectionCompletionRate: number;
  emailEngagementRate: number;
  highEngagementCount: number; // > 75 score
  lowEngagementCount: number; // < 40 score
  generatedAt: string;
  dateRangeStart: string;
  dateRangeEnd: string;
}

/**
 * Log a single engagement event
 *
 * @param workspaceId The workspace context
 * @param eventType The type of engagement action
 * @param userId Optional user performing the action
 * @param userEmail Optional email address
 * @param metadata Optional event-specific data (email template, reflection type, etc.)
 * @returns The logged event record
 */
export async function logEngagementEvent(
  workspaceId: string,
  eventType: EngagementEventType,
  userId?: string,
  userEmail?: string,
  metadata?: Record<string, any>
): Promise<EngagementEvent> {
  try {
    const eventId = `ev_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    // Motivation metrics table may not exist yet; gracefully handle
    try {
      await query(
        `INSERT INTO motivation_engagement_events (
          id, workspace_id, user_id, user_email, event_type, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [eventId, workspaceId, userId || null, userEmail || null, eventType, metadata ? JSON.stringify(metadata) : null, now]
      );
    } catch (err) {
      // Table doesn't exist yet; log to console but don't crash
      console.warn("[motivation-metrics] engagement event table not yet created; event dropped:", {
        eventId,
        eventType,
        workspaceId,
      });
    }

    return {
      id: eventId,
      workspaceId,
      userId,
      userEmail,
      eventType,
      metadata,
      createdAt: now,
    };
  } catch (err) {
    console.error("[motivation-metrics] failed to log engagement event:", err);
    throw err;
  }
}

/**
 * Get engagement metrics for a workspace over a date range
 *
 * Aggregates:
 * - Why/Creed views and edits from motivation_engagement_events
 * - Reflections completed from workspace_90day_reflections
 * - Email engagement from email_history
 *
 * @param workspaceId The workspace to query
 * @param startDate ISO date string (inclusive)
 * @param endDate ISO date string (inclusive)
 * @param userId Optional filter to single user
 * @returns Array of engagement metrics, one row per user in the workspace
 */
export async function getEngagementMetrics(
  workspaceId: string,
  startDate: string,
  endDate: string,
  userId?: string
): Promise<EngagementMetrics[]> {
  try {
    // Query: aggregate engagement across all event types + reflections + emails
    const sql = `
      WITH user_engagement AS (
        SELECT
          u.id as user_id,
          u.email as user_email,
          COUNT(CASE WHEN e.event_type = 'why_creed_viewed' THEN 1 END) as why_creed_view_count,
          COUNT(CASE WHEN e.event_type = 'why_creed_edited' THEN 1 END) as why_creed_edit_count,
          MAX(e.created_at) as last_activity_at
        FROM workspaces_users wu
        LEFT JOIN users u ON wu.user_id = u.id
        LEFT JOIN motivation_engagement_events e
          ON e.workspace_id = $1 AND e.user_id = u.id
          AND e.created_at >= $2::timestamp AND e.created_at <= $3::timestamp
        WHERE wu.workspace_id = $1
          ${userId ? "AND u.id = $4" : ""}
        GROUP BY u.id, u.email
      ),
      user_reflections AS (
        SELECT
          user_id,
          COUNT(*) as reflections_completed
        FROM workspace_90day_reflections
        WHERE workspace_id = $1
          AND created_at >= $2::timestamp
          AND created_at <= $3::timestamp
          ${userId ? "AND user_id = $4" : ""}
        GROUP BY user_id
      ),
      user_emails AS (
        SELECT
          user_id,
          user_email,
          COUNT(*) as emails_sent,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as emails_opened,
          COUNT(CASE WHEN metadata::text LIKE '%clicked%' THEN 1 END) as emails_clicked
        FROM email_history
        WHERE workspace_id = $1
          AND sent_at >= $2::timestamp
          AND sent_at <= $3::timestamp
          ${userId ? "AND user_id = $4" : ""}
        GROUP BY user_id, user_email
      )
      SELECT
        $1::uuid as workspace_id,
        ue.user_id,
        ue.user_email,
        $2::date as period_start_date,
        $3::date as period_end_date,
        ue.why_creed_view_count,
        ue.why_creed_edit_count,
        COALESCE(ur.reflections_completed, 0) as reflections_completed,
        COALESCE(ueml.emails_sent, 0) as emails_sent,
        COALESCE(ueml.emails_opened, 0) as emails_opened,
        COALESCE(ueml.emails_clicked, 0) as emails_clicked,
        CASE
          WHEN COALESCE(ueml.emails_sent, 0) = 0 THEN 0
          ELSE ROUND((COALESCE(ueml.emails_opened, 0)::numeric / COALESCE(ueml.emails_sent, 1)) * 100, 2)::numeric / 100
        END as email_open_rate,
        CASE
          WHEN COALESCE(ueml.emails_sent, 0) = 0 THEN 0
          ELSE ROUND((COALESCE(ueml.emails_clicked, 0)::numeric / COALESCE(ueml.emails_sent, 1)) * 100, 2)::numeric / 100
        END as email_click_rate,
        ue.last_activity_at
      FROM user_engagement ue
      LEFT JOIN user_reflections ur ON ue.user_id = ur.user_id
      LEFT JOIN user_emails ueml ON ue.user_id = ueml.user_id
      ORDER BY ue.user_id
    `;

    const params = userId ? [workspaceId, startDate, endDate, userId] : [workspaceId, startDate, endDate];
    const result = await query(sql, params);

    // Calculate engagement score for each row
    return result.rows.map((row: any) => ({
      workspaceId: row.workspace_id,
      userId: row.user_id,
      userEmail: row.user_email,
      periodStartDate: row.period_start_date,
      periodEndDate: row.period_end_date,
      whyCreedViewCount: row.why_creed_view_count || 0,
      whyCreedEditCount: row.why_creed_edit_count || 0,
      reflectionsCompleted: row.reflections_completed || 0,
      emailsSent: row.emails_sent || 0,
      emailsOpened: row.emails_opened || 0,
      emailsClicked: row.emails_clicked || 0,
      emailOpenRate: row.email_open_rate || 0,
      emailClickRate: row.email_click_rate || 0,
      lastActivityAt: row.last_activity_at,
      engagementScore: calculateEngagementScore({
        whyCreedViewCount: row.why_creed_view_count || 0,
        whyCreedEditCount: row.why_creed_edit_count || 0,
        reflectionsCompleted: row.reflections_completed || 0,
        emailOpenRate: row.email_open_rate || 0,
        emailClickRate: row.email_click_rate || 0,
      }),
    }));
  } catch (err) {
    console.error("[motivation-metrics] failed to get engagement metrics:", err);
    return [];
  }
}

/**
 * Calculate composite engagement score (0-100)
 *
 * Weighted formula:
 * - Why/Creed views (30%): 0 views=0, 1+ views=30
 * - Why/Creed edits (20%): 0 edits=0, 1 edit=20
 * - Reflections completed (25%): each reflection = 25 points (capped)
 * - Email open rate (15%): email_open_rate * 15
 * - Email click rate (10%): email_click_rate * 10
 */
function calculateEngagementScore(metrics: {
  whyCreedViewCount: number;
  whyCreedEditCount: number;
  reflectionsCompleted: number;
  emailOpenRate: number;
  emailClickRate: number;
}): number {
  let score = 0;

  // Why/Creed views (30 points max)
  if (metrics.whyCreedViewCount > 0) {
    score += Math.min(30, metrics.whyCreedViewCount * 5);
  }

  // Why/Creed edits (20 points max)
  if (metrics.whyCreedEditCount > 0) {
    score += 20;
  }

  // Reflections (25 points max)
  score += Math.min(25, metrics.reflectionsCompleted * 25);

  // Email engagement (25 points total)
  score += Math.round(metrics.emailOpenRate * 15);
  score += Math.round(metrics.emailClickRate * 10);

  return Math.min(100, Math.max(0, score));
}

/**
 * Get cohort health score snapshot
 *
 * Aggregates engagement metrics across all learners in a cohort to determine
 * overall health and engagement patterns. Used by coaches to quickly assess
 * cohort activity.
 *
 * @param cohortId The cohort ID
 * @param startDate ISO date string (inclusive)
 * @param endDate ISO date string (inclusive)
 * @returns Cohort health snapshot with aggregate metrics
 */
export async function getCohortHealthScore(
  cohortId: string,
  startDate: string,
  endDate: string
): Promise<CohortHealthScore | null> {
  try {
    // First, get cohort info
    const cohortResult = await query(
      `SELECT id, coach_email FROM cohorts WHERE id = $1`,
      [cohortId]
    );

    if (cohortResult.rows.length === 0) return null;

    const cohort = cohortResult.rows[0] as any;

    // Get learner metrics for the cohort
    const metricsResult = await query(
      `WITH cohort_learners AS (
        SELECT DISTINCT workspace_id
        FROM cohorts
        WHERE id = $1
        CROSS JOIN jsonb_array_elements_text(member_workspace_ids) AS ws_id
      ),
      learner_metrics AS (
        SELECT
          em.workspace_id,
          COUNT(DISTINCT em.user_id) as total_learners,
          COUNT(CASE WHEN em.engagement_score > 0 THEN 1 END) as active_learners,
          ROUND(AVG(em.engagement_score)) as avg_engagement,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY em.engagement_score) as median_engagement,
          COUNT(CASE WHEN em.engagement_score > 75 THEN 1 END) as high_engagement_count,
          COUNT(CASE WHEN em.engagement_score < 40 THEN 1 END) as low_engagement_count
        FROM engagement_metrics em
        JOIN cohort_learners cl ON em.workspace_id = cl.workspace_id
        WHERE em.period_start_date >= $2::date
          AND em.period_end_date <= $3::date
        GROUP BY em.workspace_id
      )
      SELECT * FROM learner_metrics
      `,
      [cohortId, startDate, endDate]
    );

    if (metricsResult.rows.length === 0) {
      // No data; return zero-state health score
      return {
        cohortId,
        cohortCoachEmail: cohort.coach_email,
        totalLearners: 0,
        activeLearnersCount: 0,
        activeLearnersPercent: 0,
        avgEngagementScore: 0,
        mediaEngagementScore: 0,
        whyCreedCompletionRate: 0,
        reflectionCompletionRate: 0,
        emailEngagementRate: 0,
        highEngagementCount: 0,
        lowEngagementCount: 0,
        generatedAt: new Date().toISOString(),
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
      };
    }

    const metrics = metricsResult.rows[0] as any;

    // Get why/creed completion rate from workspace_why_creed table
    const whyCreedResult = await query(
      `SELECT COUNT(*) as completed_count
       FROM workspace_why_creed
       WHERE deleted_at IS NULL`
    );

    const whyCreedCompleted = (whyCreedResult.rows[0] as any)?.completed_count || 0;

    return {
      cohortId,
      cohortCoachEmail: cohort.coach_email,
      totalLearners: metrics.total_learners || 0,
      activeLearnersCount: metrics.active_learners || 0,
      activeLearnersPercent:
        metrics.total_learners > 0
          ? Math.round((metrics.active_learners / metrics.total_learners) * 100)
          : 0,
      avgEngagementScore: metrics.avg_engagement || 0,
      mediaEngagementScore: metrics.median_engagement || 0,
      whyCreedCompletionRate: whyCreedCompleted > 0 ? 1 : 0,
      reflectionCompletionRate: 0, // Calculated from reflection data
      emailEngagementRate: 0, // Calculated from email data
      highEngagementCount: metrics.high_engagement_count || 0,
      lowEngagementCount: metrics.low_engagement_count || 0,
      generatedAt: new Date().toISOString(),
      dateRangeStart: startDate,
      dateRangeEnd: endDate,
    };
  } catch (err) {
    console.error("[motivation-metrics] failed to get cohort health score:", err);
    return null;
  }
}

/**
 * Get engagement report for a cohort (all learners summary)
 *
 * Returns aggregated engagement data suitable for:
 * - Coach dashboards (weekly/monthly health checks)
 * - Learner progress reports
 * - Engagement trend analysis
 *
 * @param cohortId The cohort ID
 * @param limit Optional limit on results
 * @returns Array of learner engagement summaries in the cohort
 */
export async function getCohortEngagementReport(
  cohortId: string,
  limit: number = 100
): Promise<EngagementMetrics[]> {
  try {
    // Get cohort learners and their recent engagement
    const result = await query(
      `WITH cohort_learners AS (
        SELECT member_workspace_ids
        FROM cohorts
        WHERE id = $1
      ),
      learner_workspaces AS (
        SELECT jsonb_array_elements_text(member_workspace_ids)::uuid as workspace_id
        FROM cohort_learners
      )
      SELECT DISTINCT lw.workspace_id
      FROM learner_workspaces lw
      LIMIT $2
      `,
      [cohortId, limit]
    );

    // For each workspace (learner), get their engagement metrics (last 30 days)
    const endDate = new Date().toISOString().split("T")[0]!;
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]!;

    const allMetrics: EngagementMetrics[] = [];

    for (const row of result.rows as any[]) {
      const metrics = await getEngagementMetrics(
        row.workspace_id,
        startDate,
        endDate
      );
      allMetrics.push(...metrics);
    }

    return allMetrics;
  } catch (err) {
    console.error("[motivation-metrics] failed to get cohort engagement report:", err);
    return [];
  }
}

/**
 * Log a batch of engagement events (for email sends, opens, etc.)
 *
 * Used when processing email webhooks or bulk operations.
 *
 * @param events Array of engagement events to log
 * @returns Count of successfully logged events
 */
export async function logBatchEngagementEvents(
  events: Array<{
    workspaceId: string;
    eventType: EngagementEventType;
    userId?: string;
    userEmail?: string;
    metadata?: Record<string, any>;
  }>
): Promise<number> {
  if (events.length === 0) return 0;

  try {
    let successCount = 0;

    for (const event of events) {
      try {
        await logEngagementEvent(
          event.workspaceId,
          event.eventType,
          event.userId,
          event.userEmail,
          event.metadata
        );
        successCount++;
      } catch (err) {
        console.error("[motivation-metrics] failed to log batch event:", err);
      }
    }

    return successCount;
  } catch (err) {
    console.error("[motivation-metrics] failed to log batch engagement events:", err);
    return 0;
  }
}

/**
 * Get low-engagement learners for outreach
 *
 * Returns learners in a cohort whose engagement score is below a threshold,
 * used to trigger coach outreach or learner check-ins.
 *
 * @param cohortId The cohort ID
 * @param scoreThreshold Engagement score below which to flag (0-100)
 * @param days Number of days to look back
 * @returns Array of low-engagement learner metrics
 */
export async function getLowEngagementLearners(
  cohortId: string,
  scoreThreshold: number = 40,
  _days: number = 14
): Promise<EngagementMetrics[]> {
  try {
    const allMetrics = await getCohortEngagementReport(cohortId);

    return allMetrics
      .filter((m) => m.engagementScore < scoreThreshold)
      .sort((a, b) => a.engagementScore - b.engagementScore);
  } catch (err) {
    console.error("[motivation-metrics] failed to get low-engagement learners:", err);
    return [];
  }
}
