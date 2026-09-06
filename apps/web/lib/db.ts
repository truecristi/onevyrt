/**
 * Postgres connection pool — the first piece of the JSON-file -> Postgres
 * migration. This app's data has lived in .gearbox/*.json under file locks
 * (see lib/root.ts, lib/file-lock.ts); that's being migrated one domain at a
 * time (see migrations/), starting with something low-risk and append-mostly
 * (sessions/activity) before touching users/workspaces/projects. Until a
 * given domain is actually cut over, its lib/*.ts file keeps reading and
 * writing JSON exactly as before — this module has no effect on it yet.
 *
 * DATABASE_URL is read once and lazily connected on first use, the same
 * "explicit env var, no fallback" posture as ONEVYRT_ROOT in lib/root.ts.
 * Never set in this repo's tracked files — add it directly to
 * apps/web/.env.local (untracked), same as SMTP_PASSWORD.
 */
import { Pool, type PoolClient } from "pg";
import { readFileSync } from "node:fs";

/**
 * TLS options for the pool. Historically this was always
 * { rejectUnauthorized: false } for any non-localhost DATABASE_URL — fine for a
 * dev-only free tier whose cert isn't in Node's trust store, but it also ran in
 * production, leaving the DB connection open to MITM. Production can now opt
 * into real verification without a code change:
 *   - DATABASE_CA_CERT       — the CA bundle PEM inline, or
 *   - DATABASE_CA_CERT_PATH  — a path to the CA bundle file, or
 *   - DATABASE_SSL_REJECT_UNAUTHORIZED=1 — strict against Node's default trust
 *                                          store (for a provider Node already
 *                                          trusts).
 *
 * In production (NODE_ENV=production), certificate verification is REQUIRED.
 * In development, permissive verification is allowed for convenience.
 */
export function buildSslConfig(needsTls: boolean): { rejectUnauthorized: boolean; ca?: string } | undefined {
  if (!needsTls) return undefined;

  const isProduction = process.env.NODE_ENV === "production";
  const caInline = process.env.DATABASE_CA_CERT;
  const caPath = process.env.DATABASE_CA_CERT_PATH;
  const rejectUnauth = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "1";

  let ca: string | undefined = caInline;
  if (!ca && caPath) {
    try { ca = readFileSync(caPath, "utf8"); }
    catch { /* fall through to the non-CA paths below rather than crash the pool */ }
  }

  if (ca) return { ca, rejectUnauthorized: true };
  if (rejectUnauth) return { rejectUnauthorized: true };

  // In production, certificate verification is mandatory (see startup-checks.ts)
  if (isProduction) {
    throw new Error(
      "CRITICAL: TLS certificate verification is not configured in production. " +
      "Set DATABASE_CA_CERT, DATABASE_CA_CERT_PATH, or DATABASE_SSL_REJECT_UNAUTHORIZED=1. " +
      "See startup-checks.ts for details."
    );
  }

  // In development, allow permissive verification for convenience
  return { rejectUnauthorized: false };
}

/**
 * Anything a parameterised query can run on — either the shared Pool or a
 * single PoolClient checked out of it. Lets a locked critical section run its
 * reads and writes on the SAME connection that holds the lock, instead of
 * checking out a second connection from the pool (see withAdvisoryLock).
 */
export type Queryable = Pick<PoolClient, "query">;

let pool: Pool | null = null;

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Throws with a clear message if DATABASE_URL isn't set — a half-configured
 *  DB path failing loudly beats one that silently no-ops. */
export function pgPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — add it to apps/web/.env.local (see lib/db.ts).");
  // Supabase's pooled connection endpoint terminates TLS with a cert not in
  // Node's default trust store. By default we don't verify it (dev-only free
  // tier), but production can opt into verification via DATABASE_CA_CERT[_PATH]
  // or DATABASE_SSL_REJECT_UNAUTHORIZED — see buildSslConfig. Local Postgres
  // (no TLS at all) is unaffected.
  const needsTls = !/localhost|127\.0\.0\.1/.test(url);
  // Pool sizing is env-tunable so production can scale it to the database's
  // real connection limit without a code change. Default 10 suits a single
  // production container against Supabase's session pooler (which caps this
  // tier at 15 concurrent clients). For heavy load (thousands of concurrent
  // users) raise DATABASE_POOL_MAX *and* the database tier, and prefer the
  // transaction pooler (pgBouncer) so a small pool multiplexes many clients —
  // see RUNBOOK. Tests set it to 1 (package.json's --test-concurrency=1).
  const max = Math.max(1, Number(process.env.DATABASE_POOL_MAX) || 10);
  // How long a caller waits for a free connection before giving up. Production
  // default of 10s sheds load fast rather than piling it up. It's env-tunable
  // because the concurrency tests deliberately fan out ~40 same-row operations
  // that serialize on a row lock: each holds one connection (no deadlock — see
  // withAdvisoryLock), so with a small pool the last waiter can legitimately
  // queue past 10s against the remote test database. CI raises this to give
  // that serial drain headroom; it can never reintroduce a deadlock.
  const connectTimeout = Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) || 10_000;
  pool = new Pool({
    connectionString: url,
    ssl: buildSslConfig(needsTls),
    max,
    // Release idle connections so the pool doesn't hoard the tier's budget.
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: connectTimeout,
  });
  return pool;
}

/**
 * Serialize a read-modify-write critical section across ALL app instances —
 * not just this process — with a Postgres transaction-scoped advisory lock,
 * keyed by an arbitrary string. This is the cross-container replacement for
 * per-process file locks (lib/file-lock.ts): a file lock only coordinates
 * writers inside one Node process, so two containers editing the same row
 * would silently lose one another's updates (see RUNBOOK "Scaling"). The
 * advisory lock is held for the lifetime of an otherwise-empty transaction
 * on a dedicated client and released automatically on COMMIT/ROLLBACK.
 *
 * `fn` receives the locked client and MUST run its reads and writes on it
 * (not on a fresh `pgPool()` connection). This keeps each locked operation to
 * a single connection: checking out a second one while holding the lock
 * connection is a pool-starvation deadlock waiting to happen — under a burst
 * of concurrent same-key calls, every lock holder occupies a connection and
 * then blocks forever waiting for another one to do its inner work, until the
 * connection timeout fires. Running the work on the lock client also makes it
 * part of the very transaction the lock scopes, so the read-modify-write is
 * atomic. Different keys never contend. `hashtext` maps the string to the
 * bigint the advisory-lock functions take.
 */
/**
 * Simple parameterised query wrapper
 */
export async function query(text: string, params?: any[]) {
  return pgPool().query(text, params);
}

/**
 * Serialize a read-modify-write critical section across ALL app instances —
 * not just this process — with a Postgres transaction-scoped advisory lock,
 * keyed by an arbitrary string. This is the cross-container replacement for
 * per-process file locks (lib/file-lock.ts): a file lock only coordinates
 * writers inside one Node process, so two containers editing the same row
 * would silently lose one another's updates (see RUNBOOK "Scaling"). The
 * advisory lock is held for the lifetime of an otherwise-empty transaction
 * on a dedicated client and released automatically on COMMIT/ROLLBACK.
 *
 * `fn` receives the locked client and MUST run its reads and writes on it
 * (not on a fresh `pgPool()` connection). This keeps each locked operation to
 * a single connection: checking out a second one while holding the lock
 * connection is a pool-starvation deadlock waiting to happen — under a burst
 * of concurrent same-key calls, every lock holder occupies a connection and
 * then blocks forever waiting for another one to do its inner work, until the
 * connection timeout fires. Running the work on the lock client also makes it
 * part of the very transaction the lock scopes, so the read-modify-write is
 * atomic. Different keys never contend. `hashtext` maps the string to the
 * bigint the advisory-lock functions take.
 */
export async function withAdvisoryLock<T>(key: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => { /* releasing the lock is best-effort */ });
    throw e;
  } finally {
    client.release();
  }
}
