/**
 * Report share links: a read-only, unauthenticated snapshot of a project's
 * Growth Brief, reachable at /share/[token] by anyone with the link — the
 * one deliberately public-facing surface in this app's data model. Postgres-
 * backed (see lib/db.ts).
 *
 * Snapshot, not live: the HTML is rendered once (client-side, same content
 * as the PDF/email export) at share-creation time and stored as-is. A
 * shared link never re-reads the live project as it keeps changing —
 * exactly like handing someone a PDF. This also means the server never
 * needs to re-run the funnel simulation to serve the page.
 *
 * Expires automatically (SHARE_TTL_MS) and can be revoked outright by the
 * workspace owner — a link is never "forever" by default, and pointing it
 * at a since-deleted project can't leave the HTML floating around unowned.
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "./db";

const SHARE_TTL_MS = 30 * 24 * 3600 * 1000;
// A rendered report snapshot is plain text/HTML in the tens of KB; 500KB is
// generous headroom without letting a pathological client request bloat
// this table indefinitely.
const MAX_HTML_LENGTH = 500_000;
// System-wide cap on concurrently active links, not per-user — this store
// has no natural per-account bound the way a project's own data does.
const MAX_ENTRIES = 2000;

/** Replaces any existing share for this project with a fresh token — only
 *  one active link per project at a time, so "get a new link" and "kill the
 *  old one" are the same action rather than two separate steps. */
export async function createShare(workspaceId: string, projectId: string, html: string): Promise<{ token: string; expiresAt: number } | { error: string }> {
  if (html.length > MAX_HTML_LENGTH) return { error: "This report is too large to share as a link — try the PDF or CSV export instead." };
  const token = randomBytes(18).toString("base64url");
  const now = Date.now();
  const expiresAt = now + SHARE_TTL_MS;
  const pool = pgPool();
  await pool.query("DELETE FROM report_shares WHERE expires_at <= $1", [now]);
  await pool.query("DELETE FROM report_shares WHERE workspace_id = $1 AND project_id = $2", [workspaceId, projectId]);
  const countRes = await pool.query("SELECT count(*) FROM report_shares");
  if (Number(countRes.rows[0].count) >= MAX_ENTRIES) return { error: "Too many active share links right now — try again shortly." };
  await pool.query(
    "INSERT INTO report_shares (token, workspace_id, project_id, html, created_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [token, workspaceId, projectId, html, new Date(now).toISOString(), expiresAt],
  );
  return { token, expiresAt };
}

/** The project's current active link, if any — so the UI can show "here's
 *  your existing link" instead of implying none exists. */
export async function getActiveShare(workspaceId: string, projectId: string): Promise<{ token: string; expiresAt: number } | null> {
  const res = await pgPool().query<{ token: string; expires_at: string }>(
    "SELECT token, expires_at FROM report_shares WHERE workspace_id = $1 AND project_id = $2 AND expires_at > $3 LIMIT 1",
    [workspaceId, projectId, Date.now()],
  );
  const row = res.rows[0];
  return row ? { token: row.token, expiresAt: Number(row.expires_at) } : null;
}

/** Revokes whatever share link(s) exist for this project. Returns whether
 *  anything was actually revoked. */
export async function revokeShare(workspaceId: string, projectId: string): Promise<boolean> {
  const res = await pgPool().query("DELETE FROM report_shares WHERE workspace_id = $1 AND project_id = $2", [workspaceId, projectId]);
  return (res.rowCount ?? 0) > 0;
}

/** Public lookup by token alone — this is the only function the
 *  unauthenticated /share/[token] page is allowed to call. */
export async function getSharedHtml(token: string): Promise<string | null> {
  const res = await pgPool().query<{ html: string }>(
    "SELECT html FROM report_shares WHERE token = $1 AND expires_at > $2", [token, Date.now()],
  );
  return res.rows[0]?.html ?? null;
}
