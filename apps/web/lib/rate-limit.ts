/**
 * Rate limiting (Ch.089). Two backends behind one async API:
 *
 *  - Postgres (when DATABASE_URL is set): a shared fixed-window counter so the
 *    limit holds across EVERY app instance. Running N containers behind a load
 *    balancer would otherwise multiply every limit by N, since an in-process
 *    counter only sees its own container's traffic (see RUNBOOK "Scaling").
 *  - In-memory fallback (no DB configured, e.g. local/dev): the original
 *    single-process fixed-window counter, so nothing depends on a database
 *    just to boot.
 *
 * The window resetting on a service restart (in-memory) or being shared
 * (Postgres) are both acceptable — limits are a safety valve, not billing.
 */
import { dbConfigured, pgPool } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  /** The window's ceiling — the `max` that was checked against. */
  limit: number;
  /** Requests still allowed in the current window (0 when blocked). */
  remaining: number;
  /** When the current window resets, as epoch milliseconds. */
  resetAt: number;
}

// ── In-memory backend ──────────────────────────────────────────────────────
interface Bucket { count: number; resetAt: number; }
const buckets = new Map<string, Bucket>();

// Unbounded keys (one per IP ever seen) would leak memory over a long uptime;
// sweep expired buckets opportunistically instead of running a timer.
const MAX_BUCKETS = 50_000;
function sweep(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

function checkInMemory(key: string, opts: { windowMs: number; max: number }): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, limit: opts.max, remaining: Math.max(0, opts.max - 1), resetAt };
  }
  if (existing.count >= opts.max) {
    return { allowed: false, retryAfterMs: existing.resetAt - now, limit: opts.max, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return { allowed: true, limit: opts.max, remaining: Math.max(0, opts.max - existing.count), resetAt: existing.resetAt };
}

// ── Postgres backend ───────────────────────────────────────────────────────
// Atomic increment-or-reset in a single statement: within the current window
// count goes up; once reset_at has passed, the row resets to a fresh window.
// RETURNING gives the post-increment count and the window end so the caller
// needs no second round-trip.
async function checkPostgres(key: string, opts: { windowMs: number; max: number }): Promise<RateLimitResult> {
  const now = Date.now();
  const newReset = now + opts.windowMs;
  const res = await pgPool().query<{ count: number; reset_at: string }>(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.reset_at <= $3 THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= $3 THEN $2 ELSE rate_limits.reset_at END
     RETURNING count, reset_at`,
    [key, newReset, now],
  );
  const row = res.rows[0]!;
  const count = Number(row.count);
  const resetAt = Number(row.reset_at);
  // Opportunistically drop expired rows (~1.5% of calls) so the table stays
  // bounded by active-window keys rather than every key ever seen — cheap
  // enough amortised, no separate cron needed.
  if (Math.random() < 0.015) {
    await pgPool().query("DELETE FROM rate_limits WHERE reset_at < $1", [now]).catch(() => { /* best-effort */ });
  }
  if (count > opts.max) return { allowed: false, retryAfterMs: Math.max(0, resetAt - now), limit: opts.max, remaining: 0, resetAt };
  return { allowed: true, limit: opts.max, remaining: Math.max(0, opts.max - count), resetAt };
}

/**
 * Check (and consume) one unit against `key`'s window. Async because the
 * shared backend is Postgres. On a DB error it degrades to the PER-PROCESS
 * in-memory limiter rather than failing fully open: a DB blip is exactly when
 * brute-force / ingest abuse is easiest, so a limiter that silently reports a
 * full window (the old behaviour) hands every attacker an unthrottled window.
 * The in-memory fallback isn't shared across instances, so it's a looser bound
 * than the Postgres one — but it's a real throttle, and unauthenticated write
 * ingest (/api/track, public funnel events) can still fire during a partial
 * outage, so a real bound matters. Auth routes need the DB anyway, so this
 * never hard-blocks a request that would otherwise have succeeded.
 */
export async function checkRateLimit(key: string, opts: { windowMs: number; max: number }): Promise<RateLimitResult> {
  // Test/CI escape hatch: the e2e suite registers many accounts in one run and
  // would otherwise trip the per-IP register/login throttle partway through.
  // Rate limits are a safety valve, not correctness — so an explicit opt-in env
  // flag disables them for that environment only. Production never sets it.
  if (process.env.RATE_LIMIT_DISABLED === "1") {
    return { allowed: true, limit: opts.max, remaining: opts.max, resetAt: Date.now() + opts.windowMs };
  }
  if (!dbConfigured()) return checkInMemory(key, opts);
  try {
    return await checkPostgres(key, opts);
  } catch {
    // Degrade to the per-process in-memory limiter — a looser but real bound —
    // instead of reporting a full open window on every DB error.
    return checkInMemory(key, opts);
  }
}

/**
 * Best-effort client IP for rate-limit bucketing. We sit behind a reverse proxy,
 * so the socket peer is always that proxy and X-Forwarded-For is the only signal.
 *
 * SECURITY: the LEFTMOST XFF entry is attacker-controlled — a client can send
 * `X-Forwarded-For: <anything>` and our edge proxy simply appends the real
 * connecting IP to the RIGHT of it. Trusting the leftmost entry therefore lets a
 * client rotate its own bucket key at will and defeat every per-IP throttle
 * (login, register, public funnel). Instead we count in from the right by the
 * number of proxy hops we actually control (TRUSTED_PROXY_COUNT, default 1 = our
 * own edge): entry `len - trusted` is the IP that connected to the outermost hop
 * we trust, which a client cannot forge. A spoofed prefix is left of that index
 * and ignored.
 */
function trustedProxyCount(): number {
  const n = Number(process.env.TRUSTED_PROXY_COUNT);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) {
      // Count in from the right by the trusted-hop count; clamp to the leftmost
      // real entry so a short header still yields the earliest attacker-immune IP.
      const idx = Math.max(0, parts.length - trustedProxyCount());
      const ip = parts[idx];
      if (ip) return ip;
    }
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export function retryAfterHeader(retryAfterMs: number): Record<string, string> {
  return { "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) };
}

/**
 * Standard rate-limit headers for an API response, so integrators can
 * self-throttle instead of discovering the limit by getting a 429:
 * X-RateLimit-Limit / -Remaining / -Reset (Reset in epoch seconds), plus
 * Retry-After when the request was blocked.
 */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const h: Record<string, string> = {
    "x-ratelimit-limit": String(r.limit),
    "x-ratelimit-remaining": String(r.remaining),
    "x-ratelimit-reset": String(Math.ceil(r.resetAt / 1000)),
  };
  if (!r.allowed && r.retryAfterMs != null) {
    h["retry-after"] = String(Math.max(1, Math.ceil(r.retryAfterMs / 1000)));
  }
  return h;
}
