/**
 * Admin audit trail: a append-only, capped record of admin-privileged actions
 * — who did what, to what, when. Separate from lib/logger.ts's general app
 * log (unstructured diagnostic lines): this is a short, queryable list meant
 * to be read by a human in the admin UI, not grepped from a log file.
 * Postgres-backed (see lib/db.ts).
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "./db";

export interface AuditEntry {
  id: string;
  at: string;
  actorEmail: string;
  action: string;
  targetType?: string;
  targetLabel?: string;
  detail?: string;
}

const MAX_ENTRIES = 500;

// Was a capped array file, naturally per-row, insert-then-trim same as
// activity/comments.
export async function recordAudit(entry: Omit<AuditEntry, "id" | "at">): Promise<void> {
  const pool = pgPool();
  await pool.query(
    "INSERT INTO audit_log (id, at, actor_email, action, target_type, target_label, detail) VALUES ($1, now(), $2, $3, $4, $5, $6)",
    [randomBytes(6).toString("hex"), entry.actorEmail, entry.action, entry.targetType ?? null, entry.targetLabel ?? null, entry.detail ?? null],
  );
  await pool.query(
    `DELETE FROM audit_log WHERE id NOT IN (SELECT id FROM audit_log ORDER BY at DESC LIMIT $1)`,
    [MAX_ENTRIES],
  );
}

/** Most recent first. */
export async function recentAudit(limit = 50): Promise<AuditEntry[]> {
  const res = await pgPool().query(
    "SELECT id, at, actor_email, action, target_type, target_label, detail FROM audit_log ORDER BY at DESC LIMIT $1", [limit],
  );
  return res.rows.map((r) => ({
    id: r.id, at: (r.at instanceof Date ? r.at.toISOString() : r.at), actorEmail: r.actor_email, action: r.action,
    ...(r.target_type ? { targetType: r.target_type } : {}),
    ...(r.target_label ? { targetLabel: r.target_label } : {}),
    ...(r.detail ? { detail: r.detail } : {}),
  }));
}
