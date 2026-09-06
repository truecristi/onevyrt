/**
 * Persisted client-side render crashes — the queryable half of the
 * /api/client-error sink so an admin can see recent breakage in the UI, not
 * just in log files. Short and capped (same posture as audit-log.ts): this is
 * for "what's failing right now", not long-term analytics.
 */
import { randomBytes } from "node:crypto";
import { dbConfigured, pgPool } from "./db";

export interface ClientErrorEntry {
  id: string;
  at: string;
  message: string;
  url?: string;
  digest?: string;
  stack?: string;
}

const MAX_ENTRIES = 500;
const MAX_MESSAGE = 1000;
const MAX_STACK = 4000;

/** Best-effort — a broken page reporting its own crash must never throw here.
 *  No-op when no database is configured (local/dev). */
export async function recordClientError(e: { message: string; url?: string; digest?: string; stack?: string }): Promise<void> {
  if (!dbConfigured()) return;
  try {
    const pool = pgPool();
    await pool.query(
      "INSERT INTO client_errors (id, at, message, url, digest, stack) VALUES ($1, now(), $2, $3, $4, $5)",
      [randomBytes(6).toString("hex"), e.message.slice(0, MAX_MESSAGE), e.url ?? null, e.digest ?? null, e.stack ? e.stack.slice(0, MAX_STACK) : null],
    );
    await pool.query(
      "DELETE FROM client_errors WHERE id NOT IN (SELECT id FROM client_errors ORDER BY at DESC LIMIT $1)",
      [MAX_ENTRIES],
    );
  } catch { /* best-effort */ }
}

/** Most recent first. */
export async function recentClientErrors(limit = 50): Promise<ClientErrorEntry[]> {
  const res = await pgPool().query(
    "SELECT id, at, message, url, digest, stack FROM client_errors ORDER BY at DESC LIMIT $1", [limit],
  );
  return res.rows.map((r) => ({
    id: r.id, at: (r.at instanceof Date ? r.at.toISOString() : r.at), message: r.message,
    ...(r.url ? { url: r.url } : {}),
    ...(r.digest ? { digest: r.digest } : {}),
    ...(r.stack ? { stack: r.stack } : {}),
  }));
}
