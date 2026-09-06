/**
 * Project storage (Ch.037/039): scoped by an opaque key — the workspace id.
 * Postgres-backed (see lib/db.ts). `doc` is an opaque serialized FunnelDoc
 * string. safeId keeps id/scopeKey values bounded and predictable, the same
 * sanitization the old on-disk filenames needed.
 */
import { pgPool, withAdvisoryLock } from "./db";

function safeId(id: string): string { return id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "untitled"; }

/** How long a deleted funnel is recoverable from the bin before it's purged. */
export const BIN_RETENTION_DAYS = 30;

export interface ProjectMeta { id: string; name: string; updatedAt: string; }
export interface DeletedProjectMeta { id: string; name: string; deletedAt: string; }
interface StoredProject { name: string; updatedAt: string; doc: string; }

// scopeKey + id together are the key, same as "one directory per scope,
// filenames unique within it" was on disk — primary key is (scope_key, id).
// Live rows only: a soft-deleted funnel (deleted_at set) is in the bin and must
// not show in the library or load as if live.
export async function listProjects(scopeKey: string): Promise<ProjectMeta[]> {
  const res = await pgPool().query(
    "SELECT id, name, updated_at FROM projects WHERE scope_key = $1 AND deleted_at IS NULL ORDER BY updated_at DESC",
    [safeId(scopeKey)],
  );
  return res.rows.map((r) => ({ id: r.id as string, name: r.name as string, updatedAt: (r.updated_at as Date).toISOString() }));
}
export async function saveProject(scopeKey: string, id: string, name: string, doc: string): Promise<ProjectMeta> {
  const updatedAt = new Date().toISOString();
  const sid = safeId(id);
  // Saving over a binned id resurrects it (deleted_at → NULL): a fresh save of a
  // reused name should be live, not silently hidden in the bin.
  await pgPool().query(
    `INSERT INTO projects (scope_key, id, name, updated_at, doc) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (scope_key, id) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at, doc = EXCLUDED.doc, deleted_at = NULL`,
    [safeId(scopeKey), sid, name, updatedAt, doc],
  );
  return { id: sid, name, updatedAt };
}

/** Outcome of an optimistic-concurrency save. `conflict` means the stored row
 *  moved since the caller loaded it — the caller must NOT have overwritten it. */
export type SaveOutcome =
  | { ok: true; meta: ProjectMeta }
  | { ok: false; conflict: true; current: { updatedAt: string; name: string } };

/**
 * Optimistic-concurrency variant of saveProject. `expectedUpdatedAt` is the
 * updatedAt the caller last saw (from a load, or its own previous save). If a
 * live row with the same (scope, id) already carries a DIFFERENT updatedAt,
 * someone else saved in the meantime, so this refuses to write and returns the
 * conflict (the API turns it into a 409 → the client prompts "changed
 * elsewhere, reload" instead of silently clobbering the other editor).
 *
 * The read (current updatedAt) and the write MUST be atomic across every
 * container, or a racing writer slips between them and both editors think they
 * won — so the whole check-then-write runs on ONE connection inside a
 * transaction-scoped advisory lock keyed by (scope, id) (see db.ts
 * withAdvisoryLock; different projects never contend). A first save (no live
 * row yet) always proceeds, exactly like saveProject — this only guards
 * overwrites of an existing row. RETURNING hands back the DB's own timestamp so
 * it exactly matches what the caller's next save will compare against.
 */
export async function saveProjectIfUnchanged(
  scopeKey: string, id: string, name: string, doc: string, expectedUpdatedAt: string,
): Promise<SaveOutcome> {
  const scope = safeId(scopeKey);
  const sid = safeId(id);
  return withAdvisoryLock<SaveOutcome>(`projects:${scope}:${sid}`, async (db) => {
    const cur = await db.query(
      "SELECT name, updated_at FROM projects WHERE scope_key = $1 AND id = $2 AND deleted_at IS NULL",
      [scope, sid],
    );
    const row = cur.rows[0];
    if (row) {
      const currentUpdatedAt = (row.updated_at as Date).toISOString();
      if (currentUpdatedAt !== expectedUpdatedAt) {
        return { ok: false, conflict: true, current: { updatedAt: currentUpdatedAt, name: row.name as string } };
      }
    }
    const updatedAt = new Date().toISOString();
    const res = await db.query(
      `INSERT INTO projects (scope_key, id, name, updated_at, doc) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (scope_key, id) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at, doc = EXCLUDED.doc, deleted_at = NULL
       RETURNING updated_at`,
      [scope, sid, name, updatedAt, doc],
    );
    return { ok: true, meta: { id: sid, name, updatedAt: (res.rows[0].updated_at as Date).toISOString() } };
  });
}
export async function loadProject(scopeKey: string, id: string): Promise<StoredProject | null> {
  const res = await pgPool().query(
    "SELECT name, updated_at, doc FROM projects WHERE scope_key = $1 AND id = $2 AND deleted_at IS NULL",
    [safeId(scopeKey), safeId(id)],
  );
  const row = res.rows[0];
  return row ? { name: row.name, updatedAt: (row.updated_at as Date).toISOString(), doc: row.doc } : null;
}
/** Soft-delete: move a funnel to the bin (recoverable for BIN_RETENTION_DAYS).
 *  No-op (returns false) if it doesn't exist or is already binned. */
export async function deleteProject(scopeKey: string, id: string): Promise<boolean> {
  const res = await pgPool().query(
    "UPDATE projects SET deleted_at = now() WHERE scope_key = $1 AND id = $2 AND deleted_at IS NULL",
    [safeId(scopeKey), safeId(id)],
  );
  return (res.rowCount ?? 0) > 0;
}
/** The bin: funnels deleted within the retention window, newest first. */
export async function listDeletedProjects(scopeKey: string): Promise<DeletedProjectMeta[]> {
  const res = await pgPool().query(
    `SELECT id, name, deleted_at FROM projects
     WHERE scope_key = $1 AND deleted_at IS NOT NULL AND deleted_at > now() - ($2 || ' days')::interval
     ORDER BY deleted_at DESC`,
    [safeId(scopeKey), String(BIN_RETENTION_DAYS)],
  );
  return res.rows.map((r) => ({ id: r.id as string, name: r.name as string, deletedAt: (r.deleted_at as Date).toISOString() }));
}
/** Restore a binned funnel back to the library. Returns false if it wasn't in
 *  the bin (never deleted, or already purged/restored). */
export async function restoreProject(scopeKey: string, id: string): Promise<boolean> {
  const res = await pgPool().query(
    "UPDATE projects SET deleted_at = NULL, updated_at = now() WHERE scope_key = $1 AND id = $2 AND deleted_at IS NOT NULL",
    [safeId(scopeKey), safeId(id)],
  );
  return (res.rowCount ?? 0) > 0;
}
/** Permanently remove a single binned funnel (the "delete forever" action).
 *  Guards on deleted_at so it can only ever hard-delete something already in the
 *  bin — a live funnel is never destroyed by this path. */
export async function purgeProject(scopeKey: string, id: string): Promise<boolean> {
  const res = await pgPool().query(
    "DELETE FROM projects WHERE scope_key = $1 AND id = $2 AND deleted_at IS NOT NULL",
    [safeId(scopeKey), safeId(id)],
  );
  return (res.rowCount ?? 0) > 0;
}
/** Hard-delete every funnel binned longer than the retention window — the daily
 *  purge job. Returns how many were removed. Never touches live rows. */
export async function purgeExpiredProjects(): Promise<number> {
  const res = await pgPool().query(
    "DELETE FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < now() - ($1 || ' days')::interval",
    [String(BIN_RETENTION_DAYS)],
  );
  return res.rowCount ?? 0;
}
/** Deletes every project under a scope (workspace) in one go — the cascade
 *  step when a workspace itself is deleted. Irreversible; callers must have
 *  already gated this behind an explicit confirmation. */
export async function deleteScope(scopeKey: string): Promise<void> {
  await pgPool().query("DELETE FROM projects WHERE scope_key = $1", [safeId(scopeKey)]);
}
/** One-time, idempotent: move legacy projects from one scope to another (no overwrite). */
export async function migrateScope(fromKey: string, toKey: string): Promise<void> {
  const from = safeId(fromKey), to = safeId(toKey);
  if (from === to) return;
  // Only rows whose id isn't already taken in the destination scope — a
  // project already there wins, same "don't overwrite an existing dest"
  // rule the old on-disk rename-if-free logic enforced.
  await pgPool().query(
    `UPDATE projects SET scope_key = $2
     WHERE scope_key = $1 AND id NOT IN (SELECT id FROM projects WHERE scope_key = $2)`,
    [from, to],
  );
}
