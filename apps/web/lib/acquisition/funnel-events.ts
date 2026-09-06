/**
 * Funnel analytics for the Acquisition OS. Records top-of-funnel events (view,
 * start) and rolls the whole funnel up — view → start → lead → qualified →
 * verified → booked — joined across funnel_events, leads and bookings, all
 * scoped to a workspace. Also reads/writes the per-funnel ad spend so
 * cost-per-qualified-lead and cost-per-booking (CAC) can be shown.
 */
import { randomUUID } from "node:crypto";
import { pgPool } from "../db";
import { funnelOwner } from "./leads";
import type { Attribution } from "./attribution";

export type FunnelEventType = "view" | "start";

/** How long raw funnel_events rows are kept. Counts live durably in the
 *  funnel_event_daily rollup, so raw rows past this window can be pruned with no
 *  loss to the funnel report (see pruneFunnelEvents / the prune job). */
export const FUNNEL_EVENT_RETENTION_DAYS = 90;

/** Record a top-of-funnel event, stamped with the funnel's owning workspace.
 *  Also increments the durable per-day rollup the analytics counts read from,
 *  so raw rows can later be pruned without shrinking those counts. */
export async function recordFunnelEvent(input: { funnelSlug: string; type: FunnelEventType; attribution?: Attribution }): Promise<void> {
  const workspaceId = await funnelOwner(input.funnelSlug);
  // Bump the durable rollup FIRST — it's the source analytics counts read from,
  // and the two writes aren't in one transaction. Ordering it before the raw
  // insert means a crash in between loses only a raw row (which the prune job
  // discards anyway), never a counted total. Unattributed events (no owner)
  // never surface in a workspace-scoped report, so they skip the rollup.
  if (workspaceId) {
    await pgPool().query(
      `INSERT INTO funnel_event_daily (workspace_id, funnel_slug, type, day, count)
       VALUES ($1, $2, $3, CURRENT_DATE, 1)
       ON CONFLICT (workspace_id, funnel_slug, type, day) DO UPDATE SET count = funnel_event_daily.count + 1`,
      [workspaceId, input.funnelSlug, input.type],
    );
  }
  await pgPool().query(
    "INSERT INTO funnel_events (id, funnel_slug, workspace_id, type, attribution) VALUES ($1,$2,$3,$4,$5)",
    [randomUUID(), input.funnelSlug, workspaceId, input.type, input.attribution ? JSON.stringify(input.attribution) : null],
  );
}

/** Delete raw funnel_events older than the retention window. Safe: the analytics
 *  counts read the funnel_event_daily rollup, not these rows, so pruning them
 *  loses no reported number. Run off the hot path by the prune_funnel_events
 *  job. Returns how many rows were removed. */
export async function pruneFunnelEvents(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - FUNNEL_EVENT_RETENTION_DAYS * 86400_000).toISOString();
  const r = await pgPool().query("DELETE FROM funnel_events WHERE created_at < $1", [cutoff]);
  return r.rowCount ?? 0;
}

export interface FunnelStage { key: string; label: string; count: number }
export interface AdBreakdownRow { source: string; leads: number; qualified: number; booked: number }
export interface FunnelReport {
  scope: "all" | string; // "all" or a specific slug
  views: number;
  starts: number;
  leads: number;
  qualified: number;
  nurture: number;
  unqualified: number;
  verified: number;
  booked: number;
  stages: FunnelStage[];
  byAd: AdBreakdownRow[];
  spend: number;
  currency: string;
  /** spend ÷ qualified (0 when no spend/qualified) */
  costPerQualified: number;
  /** spend ÷ booked */
  costPerBooking: number;
}

function slugFilter(slug?: string): { clause: string; params: unknown[] } {
  return slug ? { clause: " AND funnel_slug = $2", params: [slug] } : { clause: "", params: [] };
}

/** The full funnel report for a workspace, optionally narrowed to one funnel. */
export async function funnelAnalytics(workspaceId: string, slug?: string): Promise<FunnelReport> {
  const f = slugFilter(slug);
  const [ev, leadAgg, book, spendRow, ads] = await Promise.all([
    pgPool().query<{ type: string; n: string }>(
      // From the durable rollup, not raw funnel_events — so the counts survive
      // pruning of old raw rows.
      `SELECT type, COALESCE(SUM(count), 0)::int AS n FROM funnel_event_daily WHERE workspace_id = $1${f.clause} GROUP BY type`,
      [workspaceId, ...f.params],
    ),
    pgPool().query<{ status: string; n: string; verified: string }>(
      `SELECT status, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE verified)::int AS verified
       FROM leads WHERE workspace_id = $1 AND deleted_at IS NULL${f.clause} GROUP BY status`,
      [workspaceId, ...f.params],
    ),
    pgPool().query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM bookings WHERE workspace_id = $1 AND deleted_at IS NULL${f.clause}`,
      [workspaceId, ...f.params],
    ),
    slug
      ? pgPool().query<{ amount: string; currency: string }>("SELECT amount, currency FROM funnel_spend WHERE funnel_slug = $1 AND workspace_id = $2", [slug, workspaceId])
      : pgPool().query<{ amount: string; currency: string }>("SELECT COALESCE(SUM(amount),0) AS amount, MIN(currency) AS currency FROM funnel_spend WHERE workspace_id = $1", [workspaceId]),
    pgPool().query<{ source: string; leads: string; qualified: string }>(
      `SELECT COALESCE(NULLIF(attribution->>'utmSource',''), NULLIF(attribution->>'source',''),
                CASE WHEN attribution->>'fbclid' IS NOT NULL THEN 'meta' ELSE 'direct' END) AS source,
              COUNT(*)::int AS leads,
              COUNT(*) FILTER (WHERE status = 'qualified')::int AS qualified
       FROM leads WHERE workspace_id = $1 AND deleted_at IS NULL${f.clause}
       GROUP BY source ORDER BY qualified DESC, leads DESC LIMIT 12`,
      [workspaceId, ...f.params],
    ),
  ]);

  let views = 0, starts = 0;
  for (const r of ev.rows) { if (r.type === "view") views = Number(r.n); else if (r.type === "start") starts = Number(r.n); }
  let qualified = 0, nurture = 0, unqualified = 0, verified = 0;
  for (const r of leadAgg.rows) {
    const n = Number(r.n);
    verified += Number(r.verified);
    if (r.status === "qualified") qualified = n;
    else if (r.status === "nurture") nurture = n;
    else if (r.status === "unqualified") unqualified = n;
  }
  const leads = qualified + nurture + unqualified;
  const booked = Number(book.rows[0]?.n ?? 0);
  const spend = Number(spendRow.rows[0]?.amount ?? 0);
  const currency = spendRow.rows[0]?.currency || "USD";

  const stages: FunnelStage[] = [
    { key: "views", label: "Visited", count: views },
    { key: "starts", label: "Started", count: starts },
    { key: "leads", label: "Completed", count: leads },
    { key: "qualified", label: "Qualified", count: qualified },
    { key: "verified", label: "Verified", count: verified },
    { key: "booked", label: "Booked", count: booked },
  ];
  const byAd: AdBreakdownRow[] = ads.rows.map((r) => ({ source: r.source || "direct", leads: Number(r.leads), qualified: Number(r.qualified), booked: 0 }));

  return {
    scope: slug ?? "all",
    views, starts, leads, qualified, nurture, unqualified, verified, booked, stages, byAd,
    spend, currency,
    costPerQualified: qualified > 0 ? spend / qualified : 0,
    costPerBooking: booked > 0 ? spend / booked : 0,
  };
}

/** Set the ad spend for a funnel (owner-entered). Upsert, latest wins. */
export async function setFunnelSpend(workspaceId: string, slug: string, amount: number, currency = "USD"): Promise<void> {
  await pgPool().query(
    `INSERT INTO funnel_spend (funnel_slug, workspace_id, amount, currency, updated_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (funnel_slug) DO UPDATE SET amount = EXCLUDED.amount, currency = EXCLUDED.currency, updated_at = now()
     WHERE funnel_spend.workspace_id = $2`,
    [slug, workspaceId, Math.max(0, amount), currency],
  );
}
