/**
 * Read-only operational aggregates for the admin backend: login lockouts and
 * on-disk storage footprint. This module never writes, so surfacing it can't
 * corrupt state. Postgres-backed (see lib/db.ts) except "backups," a
 * manual/external local-disk snapshot location this app never writes to
 * itself — orthogonal to the Postgres migration, stays file-based.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { gearboxDir } from "./root";
import { pgPool } from "./db";

export interface Lockout { email: string; fails: number; lockedUntil: number; remainingMs: number; }

/** Emails currently locked out or carrying failed-attempt counters. Blank keys
 *  (attempts with no email) are dropped — they're noise, not accounts. */
export async function loginLockouts(): Promise<Lockout[]> {
  const now = Date.now();
  const res = await pgPool().query<{ email: string; fails: number; locked_until: string }>(
    "SELECT email, fails, locked_until FROM login_guard WHERE fails > 0 OR locked_until > $1", [now],
  );
  return res.rows
    .filter((r) => r.email)
    .map((r) => ({ email: r.email, fails: r.fails, lockedUntil: Number(r.locked_until), remainingMs: Math.max(0, Number(r.locked_until) - now) }))
    .sort((a, b) => b.remainingMs - a.remainingMs || b.fails - a.fails);
}

async function countEntries(dir: string): Promise<number> {
  try { return (await fs.readdir(path.join(gearboxDir(), dir))).length; } catch { return 0; }
}

export interface StorageCounts { revisions: number; backups: number; comments: number; activeResetTokens: number; }

export async function storageCounts(): Promise<StorageCounts> {
  const backups = await countEntries("backups");
  const pool = pgPool();
  const [revisions, comments, resetTokens] = await Promise.all([
    pool.query("SELECT count(DISTINCT (scope_key, project_id)) FROM revisions"),
    pool.query("SELECT count(DISTINCT (scope_key, project_id)) FROM comments"),
    pool.query("SELECT count(*) FROM reset_tokens WHERE expires_at > $1", [Date.now()]),
  ]);
  return {
    revisions: Number(revisions.rows[0].count),
    comments: Number(comments.rows[0].count),
    activeResetTokens: Number(resetTokens.rows[0].count),
    backups,
  };
}
