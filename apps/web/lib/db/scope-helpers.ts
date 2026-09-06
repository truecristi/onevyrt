/**
 * Workspace-scope query helpers (Wave 2 Lane 2 foundation). Every table that
 * holds workspace-owned rows (campaigns, leads, segments, broadcasts,
 * creatives, ...) must filter reads and writes by that workspace's id —
 * miss the guard on one query and rows from another tenant leak straight
 * through. This module makes the guard a function call instead of a string
 * every call site has to remember to type correctly, so a Wave 3+ route
 * can't ship a workspace-scoped query with the guard silently missing.
 *
 * `projects` is the one existing table this deliberately does NOT paper
 * over: its id is unique only WITHIN a workspace (primary key is
 * (scope_key, id) — see lib/store.ts), so scoping by "the row's id" doesn't
 * even make sense there without already knowing which workspace you mean.
 * These helpers scope an already-targeted query by a workspace id the
 * caller supplies; they don't discover it.
 */
import type { Queryable } from "../db";
import type { QueryResultRow } from "pg";

/** A parameterized query: `$1, $2, ...` placeholders in `text`, matching
 *  values in order. The same shape `pool.query(text, values)` takes. */
export interface ScopedQuery {
  text: string;
  values: unknown[];
}

// The guard column name is interpolated directly into SQL text — Postgres
// has no placeholder syntax for identifiers (column/table names), only for
// values. Every call site in this codebase passes a hardcoded literal
// ("workspace_id", "scope_key", ...), never anything derived from a
// request. This regex is a backstop against that assumption breaking, not
// a defense against untrusted input reaching here — an identifier should
// never be untrusted input in the first place.
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function assertSafeIdentifier(name: string, what: string): void {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`scope-helpers: ${what} must be a plain SQL identifier, got ${JSON.stringify(name)}.`);
  }
}

/**
 * Appends a `<column> = $N` guard to a base parameterized query, binding
 * `workspaceId` as that new final parameter. `base.text` should hold only
 * the query's own conditions (or none at all) — no ORDER BY / GROUP BY /
 * LIMIT yet; pass those as `suffix` so they land AFTER the guard rather than
 * between it and the rows it's meant to constrain.
 *
 * Adds `WHERE` when `base.text` has no conditions yet, `AND` when it
 * already does (detected by a case-insensitive `WHERE` keyword) — so both
 * `{ text: "SELECT id FROM campaigns" }` and
 * `{ text: "SELECT id FROM campaigns WHERE status = $1", values: ["draft"] }`
 * produce valid, correctly-numbered SQL.
 *
 *   scopedQuery({ text: "SELECT id, name FROM campaigns WHERE status = $1", values: ["draft"] }, wsId)
 *   -> { text: "SELECT id, name FROM campaigns WHERE status = $1 AND workspace_id = $2", values: ["draft", wsId] }
 *
 * `column` defaults to "workspace_id", the column every workspace-scoped
 * table uses except `projects`, which predates that convention and uses
 * "scope_key" (see lib/store.ts) — pass that explicitly for projects.
 */
export function scopedQuery(base: ScopedQuery, workspaceId: string, column = "workspace_id", suffix = ""): ScopedQuery {
  assertSafeIdentifier(column, "column");
  const placeholder = base.values.length + 1;
  const connector = /\bwhere\b/i.test(base.text) ? "AND" : "WHERE";
  const text = `${base.text} ${connector} ${column} = $${placeholder}${suffix ? ` ${suffix}` : ""}`;
  return { text, values: [...base.values, workspaceId] };
}

/**
 * Runs `base` scoped to `workspaceId` and returns its rows, typed by the
 * caller's row shape — the query-time counterpart to `scopedQuery` for
 * callers who just want rows back rather than the query object. `db` takes
 * either the shared pool or a checked-out client (see `Queryable` in
 * lib/db.ts), so this composes with `withAdvisoryLock`/row-lock helpers.
 */
export async function scopedSelect<T extends QueryResultRow = QueryResultRow>(
  db: Queryable,
  base: ScopedQuery,
  workspaceId: string,
  column = "workspace_id",
  suffix = "",
): Promise<T[]> {
  const q = scopedQuery(base, workspaceId, column, suffix);
  const res = await db.query<T>(q.text, q.values);
  return res.rows;
}

/**
 * Defense-in-depth, not the primary guard: throws if a row obtained some
 * other way (a join, a cache, a lookup by a different key) doesn't actually
 * carry the workspace id the caller believes it's scoped to. Cheap
 * insurance against a future query that forgot the guard silently handing
 * back another workspace's row — call it right after a fetch, before using
 * the row for anything. Checks `workspace_id` first, falling back to
 * `scope_key` for `projects`-shaped rows.
 */
export function assertBelongsToWorkspace(
  row: { workspace_id?: string | null; scope_key?: string | null } | null | undefined,
  workspaceId: string,
  what = "record",
): void {
  const actual = row?.workspace_id ?? row?.scope_key ?? null;
  if (!row || actual !== workspaceId) {
    throw new Error(`Workspace isolation violation: ${what} does not belong to workspace ${workspaceId}.`);
  }
}
