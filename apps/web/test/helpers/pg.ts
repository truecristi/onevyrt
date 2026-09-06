/**
 * Shared helper for tests now that every store is Postgres-only (see
 * lib/db.ts) — there's one real, shared Supabase instance behind these
 * tests, not a fresh temp directory per test the way file-mode tests used
 * to get via ONEVYRT_ROOT. Isolation instead comes from giving every test
 * file its own collision-safe id prefix (uid()), and each test file cleans
 * up whatever rows it created via an `after` hook calling one of the
 * purge helpers below.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { pgPool } from "../../lib/db";

/** A unique id/prefix for this test file's data — e.g. uid("email") for an
 *  email local-part, uid("ws") for a workspace-scoped key. Collision-safe
 *  across concurrently running test files. */
export function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

/** A fresh primary key for tables with no DB-side default on `id`
 *  (users.id, workspaces.id — both `text primaryKey`, generated app-side —
 *  see lib/auth.ts's and lib/workspaces.ts's own inserts). A raw
 *  `INSERT INTO users (email, ...) VALUES (...) RETURNING id` without
 *  supplying one violates the NOT NULL constraint; use this instead of
 *  relying on a default that doesn't exist. */
export function newId(): string {
  return randomUUID();
}

/** A `created_at` value for tables with no DB-side default on it either
 *  (users.created_at, workspaces.created_at — both `timestamptz notNull`,
 *  no default) — matches the format the real app inserts (see e.g.
 *  lib/auth.ts's registerUser: `new Date().toISOString()`). */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Deletes every user (and their sessions — sessions.user_id has no FK, so
 *  this must be explicit) whose email starts with `prefix`. Call from an
 *  `after` hook with the same prefix used to build that file's test emails. */
export async function purgeUsersByEmailPrefix(prefix: string): Promise<void> {
  const pool = pgPool();
  const res = await pool.query<{ id: string }>("SELECT id FROM users WHERE email LIKE $1", [`${prefix}%`]);
  const ids = res.rows.map((r) => r.id);
  if (ids.length === 0) return;
  await pool.query("DELETE FROM sessions WHERE user_id = ANY($1::text[])", [ids]);
  await pool.query("DELETE FROM pending_2fa WHERE user_id = ANY($1::text[])", [ids]);
  await pool.query("DELETE FROM app_events WHERE user_id = ANY($1::text[])", [ids]);
  await pool.query("DELETE FROM users WHERE id = ANY($1::text[])", [ids]);
}

/** Deletes every workspace (and, via adminDeleteWorkspace-shaped cascades in
 *  the schema, its dependent rows) whose name starts with `prefix`. */
export async function purgeWorkspacesByNamePrefix(prefix: string): Promise<void> {
  const pool = pgPool();
  const res = await pool.query<{ id: string }>("SELECT id FROM workspaces WHERE name LIKE $1", [`${prefix}%`]);
  const ids = res.rows.map((r) => r.id);
  if (ids.length > 0) {
    await pool.query("DELETE FROM app_events WHERE workspace_id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM api_keys WHERE workspace_id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM outbound_webhooks WHERE workspace_id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM workspace_entitlements WHERE workspace_id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM brand_profiles WHERE workspace_id = ANY($1::text[])", [ids]);
  }
  await pool.query("DELETE FROM workspaces WHERE name LIKE $1", [`${prefix}%`]);
}

/** Deletes login_guard rows for a given email — used by lockout tests that
 *  intentionally trip the failure counter. */
export async function purgeLoginGuard(email: string): Promise<void> {
  await pgPool().query("DELETE FROM login_guard WHERE email = $1", [email.trim().toLowerCase()]);
}

/** Deletes a tracking key and everything keyed off it (counts, journeys). */
export async function purgeTrackingKey(key: string): Promise<void> {
  const pool = pgPool();
  await pool.query("DELETE FROM tracking_journeys WHERE key = $1", [key]);
  await pool.query("DELETE FROM tracking_counts WHERE key = $1", [key]);
  await pool.query("DELETE FROM tracking_keys WHERE key = $1", [key]);
}

/** Deletes comments and revisions for one (scopeKey, projectId) pair. */
export async function purgeCommentsAndRevisions(scopeKey: string, projectId: string): Promise<void> {
  const pool = pgPool();
  await pool.query("DELETE FROM comments WHERE scope_key = $1 AND project_id = $2", [scopeKey, projectId]);
  await pool.query("DELETE FROM revisions WHERE scope_key = $1 AND project_id = $2", [scopeKey, projectId]);
}
