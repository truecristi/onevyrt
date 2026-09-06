/**
 * In-app notifications (bell icon). Postgres-backed (see lib/db.ts) —
 * one row per recipient per event, created either directly (future
 * user-facing triggers) or by a job (see lib/jobs.ts), which passes a
 * deterministic dedupeKey so re-running a job never double-notifies.
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "./db";

export interface Notification {
  id: string;
  userId: string;
  workspaceId?: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  createdAt: string;
  readAt?: string;
}

function rowToNotification(row: {
  id: string; user_id: string; workspace_id: string | null; type: string; title: string; body: string;
  link_url: string | null; created_at: Date; read_at: Date | null;
}): Notification {
  return {
    id: row.id, userId: row.user_id, type: row.type, title: row.title, body: row.body,
    createdAt: row.created_at.toISOString(),
    ...(row.workspace_id ? { workspaceId: row.workspace_id } : {}),
    ...(row.link_url ? { linkUrl: row.link_url } : {}),
    ...(row.read_at ? { readAt: row.read_at.toISOString() } : {}),
  };
}

/** Creates a notification. If `dedupeKey` is given and a row with that key
 *  already exists, this is a no-op (returns null) — the mechanism that lets
 *  a job be re-run safely without double-notifying the same recipient for
 *  the same event. */
export async function createNotification(input: {
  userId: string; workspaceId?: string; type: string; title: string; body: string; linkUrl?: string; dedupeKey?: string;
}): Promise<Notification | null> {
  const id = randomBytes(8).toString("hex");
  const res = await pgPool().query(
    `INSERT INTO notifications (id, user_id, workspace_id, type, title, body, link_url, dedupe_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id, user_id, workspace_id, type, title, body, link_url, created_at, read_at`,
    [id, input.userId, input.workspaceId ?? null, input.type, input.title, input.body, input.linkUrl ?? null, input.dedupeKey ?? null],
  );
  return res.rows[0] ? rowToNotification(res.rows[0]) : null;
}

const MAX_LISTED = 50;

/** Most recent first, capped — a bell dropdown, not a full inbox. */
export async function listNotifications(userId: string): Promise<Notification[]> {
  const res = await pgPool().query(
    "SELECT id, user_id, workspace_id, type, title, body, link_url, created_at, read_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [userId, MAX_LISTED],
  );
  return res.rows.map(rowToNotification);
}

export async function unreadCount(userId: string): Promise<number> {
  const res = await pgPool().query("SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL", [userId]);
  return Number(res.rows[0].count);
}

/** Scoped to the owning user — marking someone else's notification read is
 *  simply a no-op (the WHERE clause never matches their row). */
export async function markRead(userId: string, id: string): Promise<void> {
  await pgPool().query("UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL", [id, userId]);
}

export async function markAllRead(userId: string): Promise<void> {
  await pgPool().query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [userId]);
}
