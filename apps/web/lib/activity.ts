/**
 * Workspace activity feed: a user-facing, per-workspace log of collaboration
 * events (who did what, when) — distinct from lib/audit-log.ts, which is the
 * instance-admin-only trail across every workspace on the box. This one is
 * scoped to a single workspace and meant for its own members to read, the
 * same way Slack's channel history or a shared doc's activity panel works.
 * Postgres-backed (see lib/db.ts).
 *
 * Deliberately NOT logged here: autosave ticks. Autosave fires every ~1.5s
 * while editing, and a feed drowned in "saved" lines every few seconds would
 * be useless — call sites only record a discrete, human-meaningful action
 * (created a project, invited someone, left a comment, restored a version).
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "./db";

export interface ActivityEntry {
  id: string;
  at: string;
  actorEmail: string;
  action: string;
  projectName?: string;
  detail?: string;
}

const MAX_PER_WORKSPACE = 200;

// INSERT the new entry, then trim anything past MAX_PER_WORKSPACE for that
// workspace, matching the original "keep growth bounded" behavior.
export async function recordActivity(wsId: string, entry: Omit<ActivityEntry, "id" | "at">): Promise<void> {
  const pool = pgPool();
  await pool.query(
    `INSERT INTO activity (id, ws_id, at, actor_email, action, project_name, detail) VALUES ($1, $2, now(), $3, $4, $5, $6)`,
    [randomBytes(6).toString("hex"), wsId, entry.actorEmail, entry.action, entry.projectName ?? null, entry.detail ?? null],
  );
  await pool.query(
    `DELETE FROM activity WHERE ws_id = $1 AND id NOT IN (SELECT id FROM activity WHERE ws_id = $1 ORDER BY at DESC LIMIT $2)`,
    [wsId, MAX_PER_WORKSPACE],
  );
}

/** Most recent first. */
export async function listActivity(wsId: string, limit = 100): Promise<ActivityEntry[]> {
  const res = await pgPool().query(
    `SELECT id, at, actor_email, action, project_name, detail FROM activity WHERE ws_id = $1 ORDER BY at DESC LIMIT $2`,
    [wsId, limit],
  );
  return res.rows.map((r) => ({
    id: r.id, at: (r.at as Date).toISOString(), actorEmail: r.actor_email, action: r.action,
    ...(r.project_name ? { projectName: r.project_name } : {}),
    ...(r.detail ? { detail: r.detail } : {}),
  }));
}
