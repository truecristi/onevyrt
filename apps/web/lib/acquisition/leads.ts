/**
 * Leads store for the Acquisition OS. Records a completed qualification (any
 * status) and reads a workspace's leads + bookings for the inbox. Funnel
 * ownership (qual_funnel_owners) is what scopes rows to a tenant: a captured
 * lead is stamped with the owning workspace_id (NULL when the funnel is
 * unowned, e.g. the shared demo), and every read is filtered by workspace_id
 * so one tenant never sees another's leads. Claiming a funnel back-fills its
 * previously-unowned rows to the claiming workspace.
 */
import { randomUUID } from "node:crypto";
import { pgPool } from "../db";
import { track } from "../analytics";
import { PRODUCT_EVENT } from "../product-events";
import { addOptOut } from "../outreach/broadcasts";
import type { Attribution } from "./attribution";
import type { QualStatus } from "@onevyrt/engine";

/** Working-inbox stage, distinct from the funnel verdict (`status`). Ordered
 *  new → contacted → booked → won, with lost / nurture / unsubscribed as
 *  off-path terminal states (§322). */
export const LEAD_LIFECYCLES = ["new", "contacted", "booked", "won", "lost", "nurture", "unsubscribed"] as const;
export type LeadLifecycle = (typeof LEAD_LIFECYCLES)[number];
export function isLeadLifecycle(v: unknown): v is LeadLifecycle {
  return typeof v === "string" && (LEAD_LIFECYCLES as readonly string[]).includes(v);
}

export interface LeadRow {
  id: string;
  funnelSlug: string;
  status: QualStatus;
  lifecycle: LeadLifecycle;
  score: number;
  route: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  attribution: Attribution | null;
  verified: boolean;
  assigneeId: string | null;
  nextAction: string | null;
  dueAt: string | null;
  createdAt: string;
}

/** A partial update to a lead's follow-up state. Each key present is applied;
 *  null clears the field (unassign, drop the next action / due date). */
export interface LeadUpdate {
  lifecycle?: LeadLifecycle;
  assigneeId?: string | null;
  nextAction?: string | null;
  dueAt?: string | null;
}

export interface BookingRow {
  id: string;
  funnelSlug: string;
  slotStart: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

/** The workspace that owns a funnel, or null if it's unowned (e.g. the unclaimed
 *  demo). A builder-authored funnel (qual_funnels) owns itself; the demo can be
 *  adopted via qual_funnel_owners. The builder row wins when both exist. */
export async function funnelOwner(slug: string): Promise<string | null> {
  const r = await pgPool().query<{ workspace_id: string }>(
    `SELECT workspace_id FROM qual_funnels WHERE slug = $1
     UNION ALL
     SELECT workspace_id FROM qual_funnel_owners WHERE slug = $1
     LIMIT 1`,
    [slug],
  );
  return r.rows[0]?.workspace_id ?? null;
}

/** Record a completed qualification. Stamped with the funnel's owning
 *  workspace (resolved here) so it lands in that tenant's inbox. */
export async function recordLead(input: {
  funnelSlug: string;
  status: QualStatus;
  score: number;
  route?: string | null;
  answers?: unknown;
  attribution?: Attribution;
  name?: string;
  email?: string;
  phone?: string;
}): Promise<string> {
  const id = randomUUID();
  const workspaceId = await funnelOwner(input.funnelSlug);
  await pgPool().query(
    `INSERT INTO leads (id, funnel_slug, workspace_id, status, score, route, answers, attribution, name, email, phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id, input.funnelSlug, workspaceId, input.status, input.score, input.route ?? null,
      input.answers != null ? JSON.stringify(input.answers) : null,
      input.attribution ? JSON.stringify(input.attribution) : null,
      input.name ?? null, input.email ?? null, input.phone ?? null,
    ],
  );
  // Seed the activity timeline with the capture event (only when the funnel is
  // owned — an unowned/demo lead has no workspace to scope the event to).
  if (workspaceId) {
    await recordLeadEvent(workspaceId, id, "created", { status: input.status, score: input.score });
    // Product analytics (§27): a captured lead is the activation payoff. "First
    // lead" is derived analytically as the earliest per workspace.
    void track(PRODUCT_EVENT.LEAD_CREATED, { workspaceId, metadata: { status: input.status } });
  }
  return id;
}

/** Leads for a workspace, newest first. Excludes soft-deleted rows (see
 *  deleted_at — set by the GDPR cascade on account/workspace deletion) so a
 *  binned lead stops showing up here immediately, not just once purged. */
export async function listWorkspaceLeads(workspaceId: string, limit = 200): Promise<LeadRow[]> {
  const r = await pgPool().query(
    `SELECT id, funnel_slug, status, lifecycle, score, route, name, email, phone, attribution, verified, assignee_id, next_action, due_at, created_at
     FROM leads WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2`,
    [workspaceId, limit],
  );
  return r.rows.map((row) => ({
    id: row.id, funnelSlug: row.funnel_slug, status: row.status as QualStatus,
    lifecycle: (isLeadLifecycle(row.lifecycle) ? row.lifecycle : "new"), score: row.score,
    route: row.route, name: row.name, email: row.email, phone: row.phone,
    attribution: row.attribution ?? null, verified: !!row.verified,
    assigneeId: row.assignee_id ?? null, nextAction: row.next_action ?? null,
    dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export interface LeadDetail extends LeadRow {
  answers: Record<string, unknown> | null;
}

/** A single lead (scoped to the workspace) with its full answers — for the
 *  inbox drill-down. Returns null if it isn't this workspace's lead, or if
 *  it's been soft-deleted (see deleted_at). */
export async function getWorkspaceLead(workspaceId: string, id: string): Promise<LeadDetail | null> {
  const r = await pgPool().query(
    `SELECT id, funnel_slug, status, lifecycle, score, route, name, email, phone, attribution, verified, assignee_id, next_action, due_at, answers, created_at
     FROM leads WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL`,
    [id, workspaceId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id, funnelSlug: row.funnel_slug, status: row.status as QualStatus,
    lifecycle: (isLeadLifecycle(row.lifecycle) ? row.lifecycle : "new"), score: row.score,
    route: row.route, name: row.name, email: row.email, phone: row.phone,
    attribution: row.attribution ?? null, verified: !!row.verified,
    assigneeId: row.assignee_id ?? null, nextAction: row.next_action ?? null,
    dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
    answers: (row.answers as Record<string, unknown> | null) ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export interface LeadEvent {
  id: string;
  kind: string;
  detail: Record<string, unknown> | null;
  actorEmail: string | null;
  createdAt: string;
}

/** Append one event to a lead's activity timeline. Best-effort — a failed log
 *  must never break the action it describes, so callers ignore its result. */
export async function recordLeadEvent(workspaceId: string, leadId: string, kind: string, detail?: Record<string, unknown>, actorEmail?: string | null): Promise<void> {
  try {
    await pgPool().query(
      "INSERT INTO lead_events (id, lead_id, workspace_id, kind, detail, actor_email) VALUES ($1,$2,$3,$4,$5,$6)",
      [randomUUID(), leadId, workspaceId, kind, detail ? JSON.stringify(detail) : null, actorEmail ?? null],
    );
  } catch { /* timeline is non-critical */ }
}

/** Append the same event to many leads in one insert — used when a broadcast
 *  contacts a whole audience. Best-effort; a failed log never blocks the send. */
export async function recordLeadEventForMany(workspaceId: string, leadIds: string[], kind: string, detail?: Record<string, unknown>): Promise<void> {
  if (!leadIds.length) return;
  try {
    const det = detail ? JSON.stringify(detail) : null;
    const values: string[] = [];
    const params: unknown[] = [workspaceId, kind, det];
    for (const id of leadIds) { params.push(randomUUID(), id); values.push(`($${params.length - 1}, $${params.length}, $1, $2, $3)`); }
    await pgPool().query(
      `INSERT INTO lead_events (id, lead_id, workspace_id, kind, detail) VALUES ${values.join(", ")}`,
      params,
    );
  } catch { /* timeline is non-critical */ }
}

/** A lead's activity timeline, newest first — for the inbox drawer. */
export async function listLeadEvents(workspaceId: string, leadId: string, limit = 50): Promise<LeadEvent[]> {
  const r = await pgPool().query(
    "SELECT id, kind, detail, actor_email, created_at FROM lead_events WHERE lead_id = $1 AND workspace_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $3",
    [leadId, workspaceId, limit],
  );
  return r.rows.map((row) => ({
    id: row.id, kind: row.kind, detail: (row.detail as Record<string, unknown> | null) ?? null,
    actorEmail: row.actor_email ?? null, createdAt: new Date(row.created_at).toISOString(),
  }));
}

/** Apply a partial follow-up update to a lead. Workspace-scoped so one tenant
 *  can't touch another's leads; returns false when the lead isn't this
 *  workspace's or the patch is empty. Only the keys present in `patch` change —
 *  passing null for a nullable field clears it. Assignee membership is the
 *  caller's (API) responsibility to validate. */
export async function updateLead(workspaceId: string, id: string, patch: LeadUpdate): Promise<boolean> {
  const sets: string[] = [];
  const vals: unknown[] = [id, workspaceId];
  const add = (col: string, val: unknown) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
  if (patch.lifecycle !== undefined) add("lifecycle", patch.lifecycle);
  if (patch.assigneeId !== undefined) add("assignee_id", patch.assigneeId);
  if (patch.nextAction !== undefined) add("next_action", patch.nextAction);
  if (patch.dueAt !== undefined) add("due_at", patch.dueAt);
  if (!sets.length) return false;
  const r = await pgPool().query<{ email: string | null; phone: string | null }>(
    `UPDATE leads SET ${sets.join(", ")} WHERE id = $1 AND workspace_id = $2 RETURNING email, phone`,
    vals,
  );
  const row = r.rows[0];
  if (!row) return false;
  // Honor an unsubscribe: moving a lead to the "unsubscribed" stage suppresses
  // future broadcasts to that contact (CAN-SPAM/TCPA). Without this the opt-out
  // table is never written by the app, so a lead marked unsubscribed would keep
  // receiving campaigns. Opt out every channel address we hold. Best-effort so
  // the stage change still succeeds if the opt-out write fails, but a failure is
  // logged rather than swallowed — fail safe means recording the opt-out
  // whenever there's any doubt.
  if (patch.lifecycle === "unsubscribed") {
    try {
      if (row.email) await addOptOut(workspaceId, "email", row.email);
      if (row.phone) await addOptOut(workspaceId, "sms", row.phone);
    } catch (e) {
      console.warn(`[leads] could not record opt-out on unsubscribe for lead ${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return true;
}

/** Flag the most recent lead for a funnel + email as verified (they cleared the
 *  OTP gate). Best effort — used to badge verified leads in the inbox. */
export async function markLeadVerified(funnelSlug: string, email: string): Promise<void> {
  await pgPool().query(
    `UPDATE leads SET verified = true
     WHERE id = (SELECT id FROM leads WHERE funnel_slug = $1 AND lower(email) = lower($2) AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1)`,
    [funnelSlug, email],
  );
}

/** Upcoming + recent bookings for a workspace, soonest slot first. Excludes
 *  soft-deleted rows (see deleted_at). */
export async function listWorkspaceBookings(workspaceId: string, limit = 200): Promise<BookingRow[]> {
  const r = await pgPool().query(
    `SELECT id, funnel_slug, slot_start, name, email, phone, created_at
     FROM bookings WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY slot_start ASC LIMIT $2`,
    [workspaceId, limit],
  );
  return r.rows.map((row) => ({
    id: row.id, funnelSlug: row.funnel_slug, slotStart: row.slot_start,
    name: row.name, email: row.email, phone: row.phone, createdAt: new Date(row.created_at).toISOString(),
  }));
}

export interface AcquisitionSummary {
  leadsTotal: number;
  qualified: number;
  nurture: number;
  unqualified: number;
  leads7d: number;
  bookingsTotal: number;
  upcoming: number; // bookings whose slot is today or later
  /** qualified ÷ total, 0..1 */
  qualifyRate: number;
  /** booked ÷ qualified, 0..1 — how many good leads actually book */
  bookRate: number;
}

/** One-glance acquisition numbers for a workspace — powers the Business OS
 *  hub snapshot. `todayISO` is the caller's wall-clock date ("YYYY-MM-DD") so
 *  "upcoming" is computed against the viewer's day, not the server's. */
export async function acquisitionSummary(workspaceId: string, todayISO: string): Promise<AcquisitionSummary> {
  const [leadAgg, bookAgg] = await Promise.all([
    pgPool().query<{ status: string; n: string; recent: string }>(
      `SELECT status, COUNT(*)::int AS n,
              COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS recent
       FROM leads WHERE workspace_id = $1 AND deleted_at IS NULL GROUP BY status`,
      [workspaceId],
    ),
    pgPool().query<{ total: string; upcoming: string }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE slot_start >= $2)::int AS upcoming
       FROM bookings WHERE workspace_id = $1 AND deleted_at IS NULL`,
      [workspaceId, todayISO],
    ),
  ]);
  let qualified = 0, nurture = 0, unqualified = 0, leads7d = 0;
  for (const r of leadAgg.rows) {
    const n = Number(r.n), recent = Number(r.recent);
    leads7d += recent;
    if (r.status === "qualified") qualified = n;
    else if (r.status === "nurture") nurture = n;
    else if (r.status === "unqualified") unqualified = n;
  }
  const leadsTotal = qualified + nurture + unqualified;
  const bookingsTotal = Number(bookAgg.rows[0]?.total ?? 0);
  const upcoming = Number(bookAgg.rows[0]?.upcoming ?? 0);
  return {
    leadsTotal, qualified, nurture, unqualified, leads7d, bookingsTotal, upcoming,
    qualifyRate: leadsTotal ? qualified / leadsTotal : 0,
    bookRate: qualified ? Math.min(1, bookingsTotal / qualified) : 0,
  };
}

/** Claim a funnel for a workspace and adopt its previously-unowned rows. Returns
 *  the number of leads + bookings back-filled. Idempotent per (slug) — a second
 *  claim by the same workspace is a no-op; another workspace can't steal it. */
export async function claimFunnel(slug: string, workspaceId: string): Promise<{ owner: string; leads: number; bookings: number }> {
  // The INSERT (unique slug + ON CONFLICT DO NOTHING) is the single source of
  // truth for ownership. Re-read the owner AFTER it to learn who actually won,
  // and only the winner may adopt the pre-owner leads. The old code read the
  // owner first and then adopted unconditionally, so two concurrent claims by
  // different workspaces could split ownership — owner row went to one, but the
  // other's UPDATE still grabbed the NULL-workspace leads.
  await pgPool().query(
    "INSERT INTO qual_funnel_owners (slug, workspace_id) VALUES ($1,$2) ON CONFLICT (slug) DO NOTHING",
    [slug, workspaceId],
  );
  const owner = await funnelOwner(slug);
  if (owner !== workspaceId) return { owner: owner ?? "", leads: 0, bookings: 0 };
  // We own it — adopt rows captured before the funnel had an owner.
  const l = await pgPool().query(
    "UPDATE leads SET workspace_id = $1 WHERE funnel_slug = $2 AND workspace_id IS NULL", [workspaceId, slug],
  );
  const b = await pgPool().query(
    "UPDATE bookings SET workspace_id = $1 WHERE funnel_slug = $2 AND workspace_id IS NULL", [workspaceId, slug],
  );
  return { owner: workspaceId, leads: l.rowCount ?? 0, bookings: b.rowCount ?? 0 };
}

/**
 * Recoverable deletes for leads/bookings/lead_events (the same 30-day bin
 * shape as funnels/segments/campaigns — see lib/store.ts, lib/soft-delete.ts).
 * A captured lead's name/email/phone/answers previously had NO retention path
 * at all: deleting the workspace that owned them (see lib/workspaces.ts
 * adminDeleteWorkspace) only removed the workspace row + its projects, so
 * these rows were orphaned and kept forever.
 */
export const LEAD_BIN_RETENTION_DAYS = 30;

/** GDPR cascade (account/workspace deletion): soft-delete every lead, booking,
 *  and lead-activity-timeline row scoped to the given (deleted) workspace ids
 *  — sets deleted_at rather than removing them immediately, so the same
 *  LEAD_BIN_RETENTION_DAYS recovery window every other soft-deleted table gets
 *  also applies here, before the daily purge job (purgeExpiredLeadsAndBookings
 *  below) removes them for good. Every read in this file (and every other
 *  reader of these tables — funnel-events.ts, segments/store.ts + rules.ts,
 *  campaign/creatives-store.ts, acquisition/bookings.ts) already filters
 *  deleted_at IS NULL, so a soft-deleted row disappears from the inbox,
 *  analytics, and segment/broadcast audiences immediately. Idempotent: the
 *  deleted_at IS NULL guard means an already-binned row is left untouched, so
 *  re-running for the same workspace ids updates nothing further. Called from
 *  lib/workspaces.ts adminDeleteWorkspace, so both the admin single-workspace
 *  delete and lib/auth.ts purgeUser (which deletes each owned workspace) get
 *  it. Returns how many rows were newly binned. */
export async function softDeleteLeadsAndBookingsForWorkspaces(workspaceIds: string[]): Promise<number> {
  if (workspaceIds.length === 0) return 0;
  const pool = pgPool();
  const [leads, bookings, events] = await Promise.all([
    pool.query("UPDATE leads SET deleted_at = now() WHERE workspace_id = ANY($1::text[]) AND deleted_at IS NULL", [workspaceIds]),
    pool.query("UPDATE bookings SET deleted_at = now() WHERE workspace_id = ANY($1::text[]) AND deleted_at IS NULL", [workspaceIds]),
    pool.query("UPDATE lead_events SET deleted_at = now() WHERE workspace_id = ANY($1::text[]) AND deleted_at IS NULL", [workspaceIds]),
  ]);
  return (leads.rowCount ?? 0) + (bookings.rowCount ?? 0) + (events.rowCount ?? 0);
}

/** Hard-delete leads/bookings/lead_events that have sat soft-deleted longer
 *  than LEAD_BIN_RETENTION_DAYS — the daily purge job (see lib/jobs.ts),
 *  same shape as purgeExpiredProjects/purgeExpiredRows. Guarded on
 *  deleted_at IS NOT NULL throughout, so a live row is never touched by this
 *  path. Idempotent — a second run the same day simply finds nothing left in
 *  the window to remove. Returns how many rows were purged. */
export async function purgeExpiredLeadsAndBookings(): Promise<number> {
  const pool = pgPool();
  const window = String(LEAD_BIN_RETENTION_DAYS);
  const [leads, bookings, events] = await Promise.all([
    pool.query("DELETE FROM leads WHERE deleted_at IS NOT NULL AND deleted_at < now() - ($1 || ' days')::interval", [window]),
    pool.query("DELETE FROM bookings WHERE deleted_at IS NOT NULL AND deleted_at < now() - ($1 || ' days')::interval", [window]),
    pool.query("DELETE FROM lead_events WHERE deleted_at IS NOT NULL AND deleted_at < now() - ($1 || ' days')::interval", [window]),
  ]);
  return (leads.rowCount ?? 0) + (bookings.rowCount ?? 0) + (events.rowCount ?? 0);
}
