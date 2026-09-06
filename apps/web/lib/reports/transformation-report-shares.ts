/**
 * Transformation Report share links: a read-only, unauthenticated snapshot
 * of a workspace's Transformation Report, reachable at
 * /share/transformation/[token] by anyone with the link. Postgres-backed
 * (see lib/db.ts). Mirrors lib/report-shares.ts's project-share pattern —
 * same shape, same one-active-link-at-a-time rule — kept as its own store
 * rather than folded into report_shares because it's keyed by workspace
 * alone (a Transformation Report isn't a project) and carries a much
 * shorter, task-specified lifetime.
 *
 * Snapshot, not live: the HTML is rendered once, at share-creation time
 * (see transformationReportToHtml), and stored as-is — a link never
 * re-reads the live workspace, which keeps changing.
 *
 * Expires automatically (24 hours — deliberately short: this is a personal
 * business narrative, not a long-lived public asset) and can be revoked
 * outright by the workspace owner.
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "../db";

const SHARE_TTL_MS = 24 * 3600 * 1000;
// A rendered report snapshot is plain HTML in the tens of KB; 500KB is
// generous headroom without letting a pathological case bloat this table.
const MAX_HTML_LENGTH = 500_000;
// System-wide cap on concurrently active links, not per-workspace — same
// reasoning as report-shares.ts's MAX_ENTRIES.
const MAX_ENTRIES = 2000;

/** Replaces any existing share for this workspace with a fresh token — only
 *  one active Transformation Report link per workspace at a time. */
export async function createTransformationReportShare(workspaceId: string, html: string): Promise<{ token: string; expiresAt: number } | { error: string }> {
  if (html.length > MAX_HTML_LENGTH) return { error: "This report is too large to share as a link — try the PDF or email export instead." };
  const token = randomBytes(18).toString("base64url");
  const now = Date.now();
  const expiresAt = now + SHARE_TTL_MS;
  const pool = pgPool();
  await pool.query("DELETE FROM transformation_report_shares WHERE expires_at <= $1", [now]);
  await pool.query("DELETE FROM transformation_report_shares WHERE workspace_id = $1", [workspaceId]);
  const countRes = await pool.query("SELECT count(*) FROM transformation_report_shares");
  if (Number(countRes.rows[0].count) >= MAX_ENTRIES) return { error: "Too many active share links right now — try again shortly." };
  await pool.query(
    "INSERT INTO transformation_report_shares (token, workspace_id, html, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)",
    [token, workspaceId, html, new Date(now).toISOString(), expiresAt],
  );
  return { token, expiresAt };
}

/** The workspace's current active link, if any. */
export async function getActiveTransformationReportShare(workspaceId: string): Promise<{ token: string; expiresAt: number } | null> {
  const res = await pgPool().query<{ token: string; expires_at: string }>(
    "SELECT token, expires_at FROM transformation_report_shares WHERE workspace_id = $1 AND expires_at > $2 LIMIT 1",
    [workspaceId, Date.now()],
  );
  const row = res.rows[0];
  return row ? { token: row.token, expiresAt: Number(row.expires_at) } : null;
}

/** Revokes whatever share link currently exists for this workspace. Returns
 *  whether anything was actually revoked. */
export async function revokeTransformationReportShare(workspaceId: string): Promise<boolean> {
  const res = await pgPool().query("DELETE FROM transformation_report_shares WHERE workspace_id = $1", [workspaceId]);
  return (res.rowCount ?? 0) > 0;
}

/** Public lookup by token alone — the only function the unauthenticated
 *  /share/transformation/[token] route may call. */
export async function getSharedTransformationReportHtml(token: string): Promise<string | null> {
  const res = await pgPool().query<{ html: string }>(
    "SELECT html FROM transformation_report_shares WHERE token = $1 AND expires_at > $2", [token, Date.now()],
  );
  return res.rows[0]?.html ?? null;
}
