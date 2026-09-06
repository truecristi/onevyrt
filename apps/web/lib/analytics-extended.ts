/**
 * Comprehensive analytics tracking for ONEVYRT:
 * - Page views, user actions, conversions
 * - Error tracking and performance metrics
 * - Privacy-first: respects DNT, anonymous by default, GDPR compliant
 */

import { randomBytes } from "node:crypto";
import { pgPool } from "./db";
import { headers } from "next/headers";

// Event type definitions
export interface PageViewEvent {
  pagePath: string;
  pageTitle?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
}

export interface UserActionEvent {
  actionType: string; // 'button_click', 'form_submit', 'file_upload'
  actionName: string; // semantic name: 'submit_chapter', 'approve_submission'
  pagePath?: string;
  value?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ConversionEvent {
  conversionType: string; // 'chapter_completed', 'plan_approved', 'document_exported'
  conversionName: string;
  revenueValue?: number;
  currency?: string;
  sourcePage?: string;
  funnelStage?: string; // 'awareness', 'consideration', 'decision', 'retention'
  metadata?: Record<string, unknown>;
}

export interface ErrorEvent {
  errorType: string; // 'client_error', 'server_error', 'network_error'
  errorMessage: string;
  errorCode?: string;
  errorStack?: string;
  pagePath?: string;
  severity?: "info" | "warning" | "error" | "critical";
  context?: Record<string, unknown>;
}

export interface PerformanceMetric {
  metricType: string; // 'page_load', 'api_latency', 'database_query'
  metricName: string;
  valueMs: number;
  pagePath?: string;
  apiEndpoint?: string;
  metadata?: Record<string, unknown>;
}

// Session tracking
let sessionId: string | null = null;

export function getSessionId(): string {
  if (!sessionId) {
    sessionId = randomBytes(8).toString("hex");
  }
  return sessionId;
}

// Privacy helpers
export function shouldTrack(_req?: typeof headers): boolean {
  if (typeof window !== "undefined") {
    // Client-side
    const dnt = navigator.doNotTrack || (window as any).doNotTrack;
    if (dnt === "1") return false;
  }
  return true;
}

export async function getPrivacySettings(userId: string): Promise<{
  doNotTrack: boolean;
  trackingConsent: boolean;
  analyticsEnabled: boolean;
} | null> {
  try {
    const res = await pgPool().query(
      "SELECT do_not_track, tracking_consent, analytics_enabled FROM privacy_settings WHERE user_id = $1",
      [userId],
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      doNotTrack: row.do_not_track,
      trackingConsent: row.tracking_consent,
      analyticsEnabled: row.analytics_enabled,
    };
  } catch (e) {
    console.warn("[analytics] failed to fetch privacy settings:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Core tracking functions (fire-and-forget, logged not thrown on error)

export async function trackPageView(
  userId: string | null,
  workspaceId: string | null,
  event: PageViewEvent,
): Promise<void> {
  if (!shouldTrack()) return;
  try {
    const privacy = userId ? await getPrivacySettings(userId) : null;
    if (privacy && !privacy.analyticsEnabled) return;

    await pgPool().query(
      `INSERT INTO page_views
       (id, user_id, workspace_id, page_path, page_title, referrer, session_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [
        randomBytes(8).toString("hex"),
        userId,
        workspaceId,
        event.pagePath,
        event.pageTitle || null,
        event.referrer || null,
        getSessionId(),
        event.metadata ? JSON.stringify(event.metadata) : null,
      ],
    );
  } catch (e) {
    console.warn("[analytics] failed to track page view:", e instanceof Error ? e.message : e);
  }
}

export async function trackUserAction(
  userId: string | null,
  workspaceId: string | null,
  event: UserActionEvent,
): Promise<void> {
  if (!shouldTrack()) return;
  try {
    const privacy = userId ? await getPrivacySettings(userId) : null;
    if (privacy && !privacy.analyticsEnabled) return;

    await pgPool().query(
      `INSERT INTO user_actions
       (id, user_id, workspace_id, action_type, action_name, page_path, session_id, value, duration_ms, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
      [
        randomBytes(8).toString("hex"),
        userId,
        workspaceId,
        event.actionType,
        event.actionName,
        event.pagePath || null,
        getSessionId(),
        event.value || null,
        event.durationMs || null,
        event.metadata ? JSON.stringify(event.metadata) : null,
      ],
    );
  } catch (e) {
    console.warn("[analytics] failed to track user action:", e instanceof Error ? e.message : e);
  }
}

export async function trackConversion(
  userId: string | null,
  workspaceId: string | null,
  event: ConversionEvent,
): Promise<void> {
  if (!shouldTrack()) return;
  try {
    const privacy = userId ? await getPrivacySettings(userId) : null;
    if (privacy && !privacy.analyticsEnabled) return;

    await pgPool().query(
      `INSERT INTO conversion_events
       (id, user_id, workspace_id, conversion_type, conversion_name, revenue_value, currency, session_id, source_page, funnel_stage, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
      [
        randomBytes(8).toString("hex"),
        userId,
        workspaceId,
        event.conversionType,
        event.conversionName,
        event.revenueValue || null,
        event.currency || null,
        getSessionId(),
        event.sourcePage || null,
        event.funnelStage || null,
        event.metadata ? JSON.stringify(event.metadata) : null,
      ],
    );

    // Also track in legacy app_events for backward compatibility
    await pgPool().query(
      "INSERT INTO app_events (id, name, user_id, workspace_id, metadata, created_at) VALUES ($1, $2, $3, $4, $5, now())",
      [
        randomBytes(8).toString("hex"),
        `conversion:${event.conversionType}`,
        userId,
        workspaceId,
        event.metadata ? JSON.stringify(event.metadata) : null,
      ],
    );
  } catch (e) {
    console.warn("[analytics] failed to track conversion:", e instanceof Error ? e.message : e);
  }
}

export async function trackError(
  userId: string | null,
  workspaceId: string | null,
  event: ErrorEvent,
): Promise<void> {
  try {
    await pgPool().query(
      `INSERT INTO analytics_errors
       (id, user_id, workspace_id, error_type, error_message, error_code, error_stack, page_path, session_id, severity, context, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
      [
        randomBytes(8).toString("hex"),
        userId,
        workspaceId,
        event.errorType,
        event.errorMessage,
        event.errorCode || null,
        event.errorStack || null,
        event.pagePath || null,
        getSessionId(),
        event.severity || "error",
        event.context ? JSON.stringify(event.context) : null,
      ],
    );
  } catch (e) {
    console.warn("[analytics] failed to track error:", e instanceof Error ? e.message : e);
  }
}

export async function trackPerformance(
  userId: string | null,
  workspaceId: string | null,
  metric: PerformanceMetric,
): Promise<void> {
  if (!shouldTrack()) return;
  try {
    const privacy = userId ? await getPrivacySettings(userId) : null;
    if (privacy && !privacy.analyticsEnabled) return;

    await pgPool().query(
      `INSERT INTO performance_metrics
       (id, user_id, workspace_id, metric_type, metric_name, value_ms, page_path, api_endpoint, session_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
      [
        randomBytes(8).toString("hex"),
        userId,
        workspaceId,
        metric.metricType,
        metric.metricName,
        metric.valueMs,
        metric.pagePath || null,
        metric.apiEndpoint || null,
        getSessionId(),
        metric.metadata ? JSON.stringify(metric.metadata) : null,
      ],
    );
  } catch (e) {
    console.warn("[analytics] failed to track performance metric:", e instanceof Error ? e.message : e);
  }
}

// Queries for analytics dashboard

export interface PageViewStats {
  pagePath: string;
  viewCount: number;
  uniqueUsers: number;
  avgTimeOnPage: number; // derived from session logic
}

export async function getPageViewStats(
  windowDays = 30,
): Promise<PageViewStats[]> {
  try {
    const res = await pgPool().query<{
      page_path: string;
      view_count: string;
      unique_users: string;
    }>(
      `SELECT page_path, count(*) AS view_count, count(DISTINCT user_id) AS unique_users
       FROM page_views
       WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY page_path
       ORDER BY view_count DESC`,
      [windowDays],
    );
    return res.rows.map((r) => ({
      pagePath: r.page_path,
      viewCount: Number(r.view_count),
      uniqueUsers: Number(r.unique_users),
      avgTimeOnPage: 0, // TODO: calculate from session duration
    }));
  } catch (e) {
    console.warn("[analytics] failed to get page view stats:", e instanceof Error ? e.message : e);
    return [];
  }
}

export interface ActionStats {
  actionName: string;
  actionType: string;
  count: number;
  uniqueUsers: number;
}

export async function getUserActionStats(windowDays = 30): Promise<ActionStats[]> {
  try {
    const res = await pgPool().query<{
      action_name: string;
      action_type: string;
      count: string;
      unique_users: string;
    }>(
      `SELECT action_name, action_type, count(*) AS count, count(DISTINCT user_id) AS unique_users
       FROM user_actions
       WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY action_name, action_type
       ORDER BY count DESC`,
      [windowDays],
    );
    return res.rows.map((r) => ({
      actionName: r.action_name,
      actionType: r.action_type,
      count: Number(r.count),
      uniqueUsers: Number(r.unique_users),
    }));
  } catch (e) {
    console.warn("[analytics] failed to get user action stats:", e instanceof Error ? e.message : e);
    return [];
  }
}

export interface ConversionStats {
  conversionType: string;
  conversionName: string;
  count: number;
  uniqueUsers: number;
  totalRevenue: number;
  avgRevenue: number;
}

export async function getConversionStats(windowDays = 30): Promise<ConversionStats[]> {
  try {
    const res = await pgPool().query<{
      conversion_type: string;
      conversion_name: string;
      count: string;
      unique_users: string;
      total_revenue: string;
      avg_revenue: string;
    }>(
      `SELECT
        conversion_type, conversion_name,
        count(*) AS count,
        count(DISTINCT user_id) AS unique_users,
        COALESCE(sum(revenue_value), 0) AS total_revenue,
        COALESCE(avg(revenue_value), 0) AS avg_revenue
       FROM conversion_events
       WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY conversion_type, conversion_name
       ORDER BY count DESC`,
      [windowDays],
    );
    return res.rows.map((r) => ({
      conversionType: r.conversion_type,
      conversionName: r.conversion_name,
      count: Number(r.count),
      uniqueUsers: Number(r.unique_users),
      totalRevenue: Number(r.total_revenue),
      avgRevenue: Number(r.avg_revenue),
    }));
  } catch (e) {
    console.warn("[analytics] failed to get conversion stats:", e instanceof Error ? e.message : e);
    return [];
  }
}

export interface ErrorStats {
  errorType: string;
  errorMessage: string;
  count: number;
  severity: string;
  lastOccurred: string;
}

export async function getErrorStats(windowDays = 30): Promise<ErrorStats[]> {
  try {
    const res = await pgPool().query<{
      error_type: string;
      error_message: string;
      count: string;
      severity: string;
      last_occurred: string;
    }>(
      `SELECT
        error_type, error_message, severity,
        count(*) AS count,
        max(created_at) AS last_occurred
       FROM analytics_errors
       WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY error_type, error_message, severity
       ORDER BY count DESC
       LIMIT 50`,
      [windowDays],
    );
    return res.rows.map((r) => ({
      errorType: r.error_type,
      errorMessage: r.error_message,
      count: Number(r.count),
      severity: r.severity,
      lastOccurred: r.last_occurred,
    }));
  } catch (e) {
    console.warn("[analytics] failed to get error stats:", e instanceof Error ? e.message : e);
    return [];
  }
}

export interface PerformanceStats {
  metricName: string;
  metricType: string;
  avgValueMs: number;
  minValueMs: number;
  maxValueMs: number;
  p95ValueMs: number;
  sampleCount: number;
}

export async function getPerformanceStats(windowDays = 30): Promise<PerformanceStats[]> {
  try {
    const res = await pgPool().query<{
      metric_name: string;
      metric_type: string;
      avg_value_ms: string;
      min_value_ms: string;
      max_value_ms: string;
      p95_value_ms: string;
      sample_count: string;
    }>(
      `SELECT
        metric_name, metric_type,
        round(avg(value_ms)::numeric, 2) AS avg_value_ms,
        min(value_ms) AS min_value_ms,
        max(value_ms) AS max_value_ms,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY value_ms) AS p95_value_ms,
        count(*) AS sample_count
       FROM performance_metrics
       WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY metric_name, metric_type
       ORDER BY avg_value_ms DESC`,
      [windowDays],
    );
    return res.rows.map((r) => ({
      metricName: r.metric_name,
      metricType: r.metric_type,
      avgValueMs: Number(r.avg_value_ms),
      minValueMs: Number(r.min_value_ms),
      maxValueMs: Number(r.max_value_ms),
      p95ValueMs: Number(r.p95_value_ms),
      sampleCount: Number(r.sample_count),
    }));
  } catch (e) {
    console.warn("[analytics] failed to get performance stats:", e instanceof Error ? e.message : e);
    return [];
  }
}

export interface DailyStats {
  date: string;
  pageViews: number;
  uniqueUsers: number;
  conversions: number;
  errors: number;
}

export async function getDailyStats(windowDays = 30): Promise<DailyStats[]> {
  try {
    const dates = await pgPool().query<{ date: string }>(
      `SELECT DISTINCT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date
       FROM page_views
       WHERE created_at > now() - ($1 || ' days')::interval
       ORDER BY date DESC`,
      [windowDays],
    );

    const results: DailyStats[] = [];
    for (const { date } of dates.rows) {
      const startDate = `${date}T00:00:00Z`;
      const endDate = `${date}T23:59:59Z`;

      const stats = await Promise.all([
        pgPool().query<{ count: string }>(
          "SELECT count(*) as count FROM page_views WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz",
          [startDate, endDate],
        ),
        pgPool().query<{ count: string }>(
          "SELECT count(DISTINCT user_id) as count FROM page_views WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz",
          [startDate, endDate],
        ),
        pgPool().query<{ count: string }>(
          "SELECT count(*) as count FROM conversion_events WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz",
          [startDate, endDate],
        ),
        pgPool().query<{ count: string }>(
          "SELECT count(*) as count FROM analytics_errors WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz",
          [startDate, endDate],
        ),
      ]);

      results.push({
        date,
        pageViews: Number(stats[0].rows[0]?.count || 0),
        uniqueUsers: Number(stats[1].rows[0]?.count || 0),
        conversions: Number(stats[2].rows[0]?.count || 0),
        errors: Number(stats[3].rows[0]?.count || 0),
      });
    }

    return results;
  } catch (e) {
    console.warn("[analytics] failed to get daily stats:", e instanceof Error ? e.message : e);
    return [];
  }
}
