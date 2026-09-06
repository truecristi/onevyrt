/**
 * Internal product analytics: usage of the OneVYRT app itself, for the
 * team running it — not the customer-funnel tracking OneVYRT provides to
 * its users (see lib/tracking.ts). Postgres-backed (see lib/db.ts).
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "./db";

/** Fire-and-forget: analytics must never be the reason a real feature
 *  fails. Logged, not thrown, on error. */
export async function track(name: string, opts?: { userId?: string; workspaceId?: string; metadata?: Record<string, unknown> }): Promise<void> {
  try {
    await pgPool().query(
      "INSERT INTO app_events (id, name, user_id, workspace_id, metadata, created_at) VALUES ($1, $2, $3, $4, $5, now())",
      [randomBytes(8).toString("hex"), name, opts?.userId ?? null, opts?.workspaceId ?? null, opts?.metadata ? JSON.stringify(opts.metadata) : null],
    );
  } catch (e) {
    console.warn(`[analytics] failed to record "${name}":`, e instanceof Error ? e.message : e);
  }
}

export interface DailyCount { date: string; count: number; }
export interface EventCount { name: string; count: number; }

export interface AnalyticsSummary {
  signupsByDay: DailyCount[];
  activeUsersByDay: DailyCount[]; // distinct user_id across any event, per day
  eventCounts: EventCount[]; // totals over the same window, by event name
  windowDays: number;
}

/** Signups + rough daily-active-user counts + event-type breakdown, over
 *  the trailing `windowDays`. "Active" here means "triggered at least one
 *  tracked event" — a proxy, not a precise session definition. */
export async function analyticsSummary(windowDays = 30): Promise<AnalyticsSummary> {
  const pool = pgPool();
  const [signups, active, counts] = await Promise.all([
    pool.query<{ date: string; count: string }>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date, count(*) AS count
       FROM app_events WHERE name = 'user_registered' AND created_at > now() - ($1 || ' days')::interval
       GROUP BY 1 ORDER BY 1`,
      [windowDays],
    ),
    pool.query<{ date: string; count: string }>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date, count(DISTINCT user_id) AS count
       FROM app_events WHERE user_id IS NOT NULL AND created_at > now() - ($1 || ' days')::interval
       GROUP BY 1 ORDER BY 1`,
      [windowDays],
    ),
    pool.query<{ name: string; count: string }>(
      `SELECT name, count(*) AS count FROM app_events WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY 1 ORDER BY 2 DESC`,
      [windowDays],
    ),
  ]);
  return {
    signupsByDay: signups.rows.map((r) => ({ date: r.date, count: Number(r.count) })),
    activeUsersByDay: active.rows.map((r) => ({ date: r.date, count: Number(r.count) })),
    eventCounts: counts.rows.map((r) => ({ name: r.name, count: Number(r.count) })),
    windowDays,
  };
}
