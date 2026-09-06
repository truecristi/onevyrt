import crypto from "node:crypto";
import { pgPool } from "./db";

/** Metadata for one saved snapshot. Postgres-backed (see lib/db.ts) — the
 *  doc itself lives in the same row (see the migration notes: this used to
 *  be an index file plus a sibling doc file per revision on disk, folded
 *  into one per-row table since Postgres doesn't need that split). */
export interface RevisionMeta {
  id: string;
  userId: string;
  email: string;
  createdAt: string;
  note: string;
  /** Headline numbers captured at save time, so the list reads without re-simulating. */
  revenue?: number;
  profit?: number;
}

const MAX_REVISIONS = 50;

function rowToRevisionMeta(row: { id: string; user_id: string; email: string; created_at: Date; note: string; revenue: string | null; profit: string | null }): RevisionMeta {
  return {
    id: row.id, userId: row.user_id, email: row.email, createdAt: row.created_at.toISOString(), note: row.note,
    ...(row.revenue != null ? { revenue: Number(row.revenue) } : {}),
    ...(row.profit != null ? { profit: Number(row.profit) } : {}),
  };
}

/** Newest first — the panel shows the most recent snapshot at the top. */
export async function listRevisions(scopeKey: string, projectId: string): Promise<RevisionMeta[]> {
  const res = await pgPool().query(
    // Cap the history to the 200 most recent so a project with a long edit
    // history never returns an unbounded payload (older snapshots stay in the
    // table and are still fetchable by id).
    "SELECT id, user_id, email, created_at, note, revenue, profit FROM revisions WHERE scope_key = $1 AND project_id = $2 ORDER BY created_at DESC LIMIT 200",
    [scopeKey, projectId],
  );
  return res.rows.map(rowToRevisionMeta);
}

export async function saveRevision(
  scopeKey: string,
  projectId: string,
  userId: string,
  email: string,
  doc: string,
  note = "",
  headline?: { revenue?: number; profit?: number },
): Promise<RevisionMeta> {
  const meta: RevisionMeta = {
    id: crypto.randomBytes(8).toString("hex"),
    userId,
    email,
    createdAt: new Date().toISOString(),
    note: note.trim().slice(0, 200),
    ...(headline?.revenue != null ? { revenue: headline.revenue } : {}),
    ...(headline?.profit != null ? { profit: headline.profit } : {}),
  };
  const pool = pgPool();
  await pool.query(
    "INSERT INTO revisions (id, scope_key, project_id, user_id, email, created_at, note, revenue, profit, doc) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [meta.id, scopeKey, projectId, userId, email, meta.createdAt, meta.note, headline?.revenue ?? null, headline?.profit ?? null, doc],
  );
  await pool.query(
    `DELETE FROM revisions WHERE scope_key = $1 AND project_id = $2
     AND id NOT IN (SELECT id FROM revisions WHERE scope_key = $1 AND project_id = $2 ORDER BY created_at DESC LIMIT $3)`,
    [scopeKey, projectId, MAX_REVISIONS],
  );
  return meta;
}

/** Returns the serialized doc for a revision, or null if it is unknown. */
export async function getRevision(scopeKey: string, projectId: string, revId: string): Promise<string | null> {
  const res = await pgPool().query<{ doc: string }>(
    "SELECT doc FROM revisions WHERE id = $1 AND scope_key = $2 AND project_id = $3", [revId, scopeKey, projectId],
  );
  return res.rows[0]?.doc ?? null;
}
