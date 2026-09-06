/**
 * Generic recoverable-bin plumbing, shared by every entity that supports the
 * 30-day soft delete (funnels have their own copy in lib/store.ts; this covers
 * the rest). Delete stamps deleted_at; the bin lists rows deleted within the
 * window; restore clears it; permanent-delete and the daily purge are both
 * guarded on deleted_at IS NOT NULL, so a live row can never be hard-destroyed
 * through these paths.
 *
 * Table and column names come only from the BIN_TABLES whitelist below — never
 * from a request — so interpolating them into SQL carries no injection risk,
 * while every value is still a bound parameter.
 */
import { pgPool } from "./db";

export const BIN_RETENTION_DAYS = 30;

const BIN_TABLES = {
  segments: { scope: "workspace_id", id: "id", name: "name" },
  campaigns: { scope: "workspace_id", id: "id", name: "name" },
} as const;
export type BinTable = keyof typeof BIN_TABLES;

export interface DeletedRow { id: string; name: string; deletedAt: string; }

/** Soft-delete one row into the bin. False if it doesn't exist or is already binned. */
export async function softDeleteRow(table: BinTable, scope: string, id: string): Promise<boolean> {
  const t = BIN_TABLES[table];
  const r = await pgPool().query(
    `UPDATE ${table} SET deleted_at = now() WHERE ${t.scope} = $1 AND ${t.id} = $2 AND deleted_at IS NULL`,
    [scope, id],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Restore a binned row. False if it wasn't in the bin. */
export async function restoreRow(table: BinTable, scope: string, id: string): Promise<boolean> {
  const t = BIN_TABLES[table];
  const r = await pgPool().query(
    `UPDATE ${table} SET deleted_at = NULL WHERE ${t.scope} = $1 AND ${t.id} = $2 AND deleted_at IS NOT NULL`,
    [scope, id],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Permanently remove a single binned row. Guarded so a live row is never hit. */
export async function purgeRow(table: BinTable, scope: string, id: string): Promise<boolean> {
  const t = BIN_TABLES[table];
  const r = await pgPool().query(
    `DELETE FROM ${table} WHERE ${t.scope} = $1 AND ${t.id} = $2 AND deleted_at IS NOT NULL`,
    [scope, id],
  );
  return (r.rowCount ?? 0) > 0;
}

/** The bin for one scope: rows deleted within the retention window, newest first. */
export async function listDeletedRows(table: BinTable, scope: string): Promise<DeletedRow[]> {
  const t = BIN_TABLES[table];
  const r = await pgPool().query(
    `SELECT ${t.id} AS id, ${t.name} AS name, deleted_at FROM ${table}
     WHERE ${t.scope} = $1 AND deleted_at IS NOT NULL AND deleted_at > now() - ($2 || ' days')::interval
     ORDER BY deleted_at DESC`,
    [scope, String(BIN_RETENTION_DAYS)],
  );
  return r.rows.map((row) => ({ id: row.id as string, name: (row.name as string) ?? "(untitled)", deletedAt: new Date(row.deleted_at).toISOString() }));
}

/** Hard-delete expired rows across every binned table (the daily purge). Returns
 *  the total removed. Never touches live rows. */
export async function purgeExpiredRows(): Promise<number> {
  let total = 0;
  for (const table of Object.keys(BIN_TABLES) as BinTable[]) {
    const r = await pgPool().query(
      `DELETE FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < now() - ($1 || ' days')::interval`,
      [String(BIN_RETENTION_DAYS)],
    );
    total += r.rowCount ?? 0;
  }
  return total;
}
