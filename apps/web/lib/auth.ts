/**
 * Auth foundation (Ch.038): identity without lock-in. Node's built-in crypto
 * only for hashing/signing. scrypt for password hashing, HMAC-SHA256 signed
 * stateless session cookies. The signing secret is generated once and stored
 * in .gearbox/auth-secret (0600) — a local signing key, not business data, so
 * it stayed out of the Postgres migration below. Users/sessions/login-guard/
 * reset-tokens/pending-2FA all live in Postgres (see lib/db.ts) — this file
 * no longer has a file-based fallback; DATABASE_URL is required.
 */
import { gearboxDir, announceRoot } from "./root";
import { pgPool } from "./db";
import { listAllWorkspaces, adminDeleteWorkspace, adminRemoveMember } from "./workspaces";
import { deleteCohortsForCoach } from "./cohorts";
import { generateTotpSecret, verifyTotp, generateBackupCodes, hashBackupCode, totpUri } from "./twofa";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

function secretPath(): string { return path.join(gearboxDir(), "auth-secret"); }

let cachedSecret: string | null = null;
export function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  // An explicit AUTH_SECRET env var takes priority over the on-disk key. This
  // is what lets multiple replicas — or a restart on non-persistent storage —
  // share ONE signing key instead of each generating its own local
  // .gearbox/auth-secret, which would invalidate every session/reset/2FA token
  // signed by the others and log everyone out. Unset = unchanged behaviour: the
  // file below stays the source of truth for existing single-instance deploys.
  // Used only as HMAC key material (see signSession/hashToken/hashBackupCode),
  // so no format constraint — any stable, sufficiently random string works.
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) { cachedSecret = fromEnv; return fromEnv; }
  try { const s = readFileSync(secretPath(), "utf8").trim(); if (s) { cachedSecret = s; return s; } } catch { /* generate below */ }
  const secret = randomBytes(32).toString("hex");
  mkdirSync(gearboxDir(), { recursive: true });
  writeFileSync(secretPath(), secret, { mode: 0o600 });
  cachedSecret = secret;
  return secret;
}

// scrypt (not scryptSync): the sync version blocks Node's single JS thread
// for the full ~50-100ms hash computation — with more than a handful of
// logins landing close together, every other request the server is
// handling (other people's logins, page loads, tracking pings) queues up
// behind each one in turn, serially, since nothing else can run while the
// main thread is busy. The async version offloads the actual computation to
// libuv's worker pool, so concurrent logins actually run concurrently
// instead of the whole server stalling once per login.
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = await scrypt(password, salt, 64) as Buffer;
  const want = Buffer.from(hash, "hex");
  return test.length === want.length && timingSafeEqual(test, want);
}

export function signSession(userId: string, ttlMs = 30 * 24 * 3600 * 1000, sessionId?: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + ttlMs, ...(sessionId ? { sid: sessionId } : {}) })).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
/** Verifies signature/shape/expiry only — pure, no I/O, no revocation check.
 *  Kept for the raw-token pieces (impersonation) that don't need a session
 *  record. currentUser() below layers the revocation check on top for the
 *  main session cookie. */
export function verifySession(token: string | null | undefined): string | null {
  const parsed = decodeSessionToken(token);
  return parsed?.uid ?? null;
}
function decodeSessionToken(token: string | null | undefined): { uid: string; sid?: string } | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid?: unknown; exp?: unknown; sid?: unknown };
    if (typeof parsed.uid !== "string" || typeof parsed.exp !== "number" || Date.now() > parsed.exp) return null;
    return { uid: parsed.uid, sid: typeof parsed.sid === "string" ? parsed.sid : undefined };
  } catch { return null; }
}

/**
 * Server-side session records (Ch. session management): auth is otherwise
 * stateless signed tokens, which means there was previously no way to list
 * or revoke a specific session — the only "revoke everything" lever was
 * rotating the signing secret, which logs out every user on the instance.
 * This adds a real record per issued session so a user can see "what's
 * signed into my account" and kill one device without affecting the others.
 * The signed token remains the bearer credential (still HMAC'd, still
 * needed); the store is what makes a single session revocable before its
 * natural expiry.
 */
export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent?: string;
  expiresAt: number;
  revoked?: boolean;
}
function rowToSessionRecord(row: { id: string; user_id: string; created_at: Date; last_seen_at: Date; user_agent: string | null; expires_at: Date; revoked: boolean }): SessionRecord {
  return {
    id: row.id, userId: row.user_id,
    createdAt: row.created_at.toISOString(), lastSeenAt: row.last_seen_at.toISOString(),
    expiresAt: row.expires_at.getTime(),
    ...(row.user_agent ? { userAgent: row.user_agent } : {}),
    ...(row.revoked ? { revoked: true } : {}),
  };
}

/** Issues a new signed session AND a server-side record for it. Use this
 *  instead of bare signSession() for any real login/signup/impersonation —
 *  it's what makes the session show up in "active sessions" and be revocable. */
export async function createSession(userId: string, opts?: { userAgent?: string }, ttlMs = 30 * 24 * 3600 * 1000): Promise<string> {
  const id = randomBytes(12).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const userAgent = opts?.userAgent ? opts.userAgent.slice(0, 200) : null;
  await pgPool().query(
    `INSERT INTO sessions (id, user_id, created_at, last_seen_at, user_agent, expires_at, revoked)
     VALUES ($1, $2, $3, $3, $4, $5, false)`,
    [id, userId, now.toISOString(), userAgent, expiresAt.toISOString()],
  );
  return signSession(userId, ttlMs, id);
}

/** True once sid-less (legacy) tokens should be rejected outright, per the
 *  operator-set cutoff SESSION_SID_REQUIRED_AFTER (an ISO date/time). Legacy
 *  tokens predate server-side session records, so they can't be revoked or
 *  "logged out everywhere" — a real, if bounded, gap. Set the cutoff to ~one
 *  max-session-TTL after a deploy: until then legacy tokens keep working (no
 *  forced logouts), and after it every still-valid session has re-logged in
 *  with a sid, so sid-less tokens can be safely refused. Unset = permissive
 *  (unchanged behaviour). Exported for tests. */
export function legacySessionsCutoffPassed(now = Date.now()): boolean {
  const cutoff = process.env.SESSION_SID_REQUIRED_AFTER;
  if (!cutoff) return false;
  const ts = Date.parse(cutoff);
  return Number.isFinite(ts) && now >= ts;
}

/** Resolves a token to its user id, honoring server-side revocation for
 *  tokens that carry a session id. Tokens without a sid (issued before this
 *  feature existed) still work purely on signature+expiry — until the
 *  SESSION_SID_REQUIRED_AFTER cutoff, after which they're rejected so no
 *  session escapes revocation forever. Touches lastSeenAt so "active
 *  sessions" reflects reality, not just issue time. */
async function resolveSession(token: string | null | undefined): Promise<string | null> {
  const parsed = decodeSessionToken(token);
  if (!parsed) return null;
  if (!parsed.sid) return legacySessionsCutoffPassed() ? null : parsed.uid;
  const pool = pgPool();
  const res = await pool.query<{ user_id: string; revoked: boolean }>(
    `SELECT user_id, revoked FROM sessions WHERE id = $1`, [parsed.sid],
  );
  const row = res.rows[0];
  if (!row || row.revoked || row.user_id !== parsed.uid) return null;
  await pool.query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [parsed.sid]);
  return parsed.uid;
}

/** Sessions for a user, most recent first — for the account's "active
 *  sessions" panel. Never includes anyone else's sessions. */
export async function listSessions(userId: string): Promise<SessionRecord[]> {
  const res = await pgPool().query(
    `SELECT id, user_id, created_at, last_seen_at, user_agent, expires_at, revoked FROM sessions
     WHERE user_id = $1 AND revoked = false AND expires_at > now() ORDER BY last_seen_at DESC`,
    [userId],
  );
  return res.rows.map(rowToSessionRecord);
}
/** Revokes one session. Scoped to the owning user — you can only revoke
 *  your own sessions, never look up an id belonging to someone else. */
export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const res = await pgPool().query(`UPDATE sessions SET revoked = true WHERE id = $1 AND user_id = $2`, [sessionId, userId]);
  if (res.rowCount === 0) throw new Error("Session not found.");
}
/** "Log out everywhere else": revokes every session for this user except
 *  the one making the request. Returns how many were revoked. */
export async function revokeOtherSessions(userId: string, keepSessionId: string | undefined): Promise<number> {
  const res = await pgPool().query(
    `UPDATE sessions SET revoked = true WHERE user_id = $1 AND id IS DISTINCT FROM $2 AND revoked = false`,
    [userId, keepSessionId ?? null],
  );
  return res.rowCount ?? 0;
}

export interface User { id: string; email: string; createdAt: string; disabled?: boolean; avatarUrl?: string; }
interface StoredUser extends User {
  pass: string;
  /** Set as soon as setup starts, before confirmation — lets "scan again"
   *  work if the user navigates away mid-setup without finishing it. */
  twofaPendingSecret?: string;
  /** Only set once a real 6-digit code from the app confirmed the secret —
   *  this, not twofaPendingSecret, is what actually gates login. */
  twofaSecret?: string;
  twofaEnabled?: boolean;
  /** HMAC hashes only, never the plaintext codes — same principle as
   *  password/reset-token storage. Consumed (removed) one at a time. */
  twofaBackupHashes?: string[];
}

announceRoot();

/**
 * Security check: In production, AUTH_SECRET must be explicitly set.
 * This prevents accidental session loss when containers restart without
 * persistent storage for .gearbox/auth-secret.
 * Called by startup-checks.ts during app initialization.
 */
export function checkAuthSecretConfiguration(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const isSet = Boolean(process.env.AUTH_SECRET?.trim());

  if (isProduction && !isSet) {
    throw new Error(
      "CRITICAL: AUTH_SECRET is not set in production. " +
      "Generate a 64-character hex string: node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))'. " +
      "Set it as an environment variable before deploying. " +
      "All instances must share the same secret, or sessions will be invalidated on failover."
    );
  }
}

// Run auth security check at module load time (called when auth.ts is
// imported) — except during `next build` itself. Next sets NEXT_PHASE to
// "phase-production-build" (never at real serve time — `next start` or
// Vercel's runtime — only for this one-time static-analysis/bundling pass)
// while it collects page data, which requires actually loading this module
// (app/layout.tsx's CsrfTokenInitializer -> lib/middleware/csrf.ts ->
// getSecret() here) with no real request to protect. Previously this threw
// unconditionally the moment AUTH_SECRET was unset in a production build —
// exactly CI's condition (deploy secrets aren't, and shouldn't be, present
// at build time) — breaking `next build --webpack` outright. The runtime
// safety property this guards (AUTH_SECRET must be set before the app
// actually serves production traffic) is unaffected: NEXT_PHASE isn't
// "phase-production-build" once a real server process is handling requests.
if (process.env.NEXT_PHASE !== "phase-production-build") {
  checkAuthSecretConfiguration();
}

function rowToStoredUser(row: {
  id: string; email: string; created_at: Date; pass: string; disabled: boolean; avatar_url: string | null;
  twofa_pending_secret: string | null; twofa_secret: string | null; twofa_enabled: boolean; twofa_backup_hashes: string[] | null;
}): StoredUser {
  return {
    id: row.id, email: row.email, createdAt: row.created_at.toISOString(), pass: row.pass,
    ...(row.disabled ? { disabled: true } : {}),
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
    ...(row.twofa_pending_secret ? { twofaPendingSecret: row.twofa_pending_secret } : {}),
    ...(row.twofa_secret ? { twofaSecret: row.twofa_secret } : {}),
    ...(row.twofa_enabled ? { twofaEnabled: true } : {}),
    ...(row.twofa_backup_hashes && row.twofa_backup_hashes.length ? { twofaBackupHashes: row.twofa_backup_hashes } : {}),
  };
}
const USER_COLUMNS = "id, email, created_at, pass, disabled, avatar_url, twofa_pending_secret, twofa_secret, twofa_enabled, twofa_backup_hashes";

function toPublicUser(u: StoredUser): User {
  return { id: u.id, email: u.email, createdAt: u.createdAt, disabled: u.disabled, ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}) };
}

/** True for a Postgres unique-constraint violation (error code 23505) — used
 *  to turn a duplicate-email INSERT into the same friendly message the old
 *  full-table-scan check gave, without a separate existence check first. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

/**
 * Row-level replacement for the old "read whole users table, mutate in
 * memory, write whole table back" pattern every account-mutating function
 * used to share (see git history — `withFileLock(USERS_LOCK_KEY, ...)`
 * around a full readUsers()/writeUsers() pair). That worked but meant every
 * password change, avatar update, or 2FA toggle round-tripped the entire
 * table and only ever serialized safely within one Node process — useless
 * the moment this runs as more than one instance.
 *
 * This instead opens a transaction, locks just the target row
 * (`SELECT ... FOR UPDATE`), and lets the caller inspect/mutate it with
 * targeted UPDATEs before COMMIT. Real row-level locking, safe across any
 * number of server instances, and touches only the one row involved.
 */
async function withUserRowLock<T>(userId: string, fn: (row: StoredUser, client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const row = res.rows[0];
    if (!row) throw new Error("User not found.");
    const result = await fn(rowToStoredUser(row), client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => { /* connection may already be dead */ });
    throw e;
  } finally {
    client.release();
  }
}

export async function registerUser(email: string, password: string): Promise<User> {
  const e = email.trim().toLowerCase();
  if (!e || !e.includes("@")) throw new Error("A valid email is required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const passHash = await hashPassword(password);
  const id = randomBytes(12).toString("hex");
  const createdAt = new Date().toISOString();
  try {
    // Relies on the DB's own unique constraint on email (see
    // migrations/1786528429683_create-users.js) rather than a check-then-insert
    // — that's actually race-safe against concurrent signups for the same
    // email, which a separate SELECT-first check would not be.
    await pgPool().query("INSERT INTO users (id, email, created_at, pass) VALUES ($1, $2, $3, $4)", [id, e, createdAt, passHash]);
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error("That email is already registered.");
    throw err;
  }
  return { id, email: e, createdAt };
}
// A fixed credential to verify against when the email doesn't exist, so a login
// for an unknown account costs the same scrypt work as a real one. Without it,
// authenticate returned immediately for an unknown email but paid scrypt for a
// known one — that timing gap lets an attacker enumerate which emails are
// registered. Computed once, lazily, and cached.
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword("onevyrt:timing-equalizer:not-a-real-credential");
  return dummyHashPromise;
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const e = email.trim().toLowerCase();
  const res = await pgPool().query(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [e]);
  const u = res.rows[0] ? rowToStoredUser(res.rows[0]) : null;
  // Always run exactly one scrypt verification — against the real hash when the
  // account exists, against the dummy when it doesn't — so an unknown email
  // takes the same time as a known one (no account enumeration by timing). A
  // disabled account also runs it before being refused, for the same reason.
  const ok = await verifyPassword(password, u ? u.pass : await dummyHash());
  if (!u || u.disabled || !ok) return null;
  return { id: u.id, email: u.email, createdAt: u.createdAt, ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}) };
}
export async function getUserById(id: string): Promise<User | null> {
  const res = await pgPool().query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return res.rows[0] ? toPublicUser(rowToStoredUser(res.rows[0])) : null;
}
export async function getUserByEmail(email: string): Promise<User | null> {
  const e = email.trim().toLowerCase();
  const res = await pgPool().query(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [e]);
  return res.rows[0] ? toPublicUser(rowToStoredUser(res.rows[0])) : null;
}
/** Deactivate/reactivate an account without touching anything it owns —
 *  workspaces and projects are left exactly as they are so a reactivated
 *  user comes back to everything intact. Disabling also kills any live
 *  session immediately (see currentUser below), not just future logins. */
export async function setUserDisabled(id: string, disabled: boolean): Promise<User> {
  const res = await pgPool().query(`UPDATE users SET disabled = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`, [id, disabled]);
  const row = res.rows[0];
  if (!row) throw new Error("User not found.");
  return toPublicUser(rowToStoredUser(row));
}

/**
 * Permanently deletes an account and everything it exclusively owns.
 * Irreversible — unlike setUserDisabled above, there's no coming back from
 * this. Refuses outright if the user owns a workspace that has OTHER members:
 * that data isn't exclusively theirs to take with them, so the admin has to
 * reassign or clear that workspace first rather than this function guessing
 * what to do with someone else's access to it.
 *
 * This is the ONE place the full right-to-erasure cascade lives — both the
 * self-service delete-account route and the admin-triggered
 * DELETE /api/admin/users/[id] call this function, so both get it for free.
 * Deleting each owned workspace below (adminDeleteWorkspace, lib/workspaces.ts)
 * already carries its own workspace-scoped slice of the cascade — cohort
 * rosters, enrollments, entitlements, and leads/bookings/lead-events
 * (soft-deleted, not hard-deleted — see lib/acquisition/leads.ts) — so the
 * only piece added here is deleteCohortsForCoach: this user's OWN cohorts
 * (keyed by coach_user_id, not by any one workspace), which stops pacing the
 * other learners those cohorts hold once this coach's account is gone. Every
 * step here is idempotent and scoped to this account alone.
 */
export async function purgeUser(id: string): Promise<{ email: string; deletedWorkspaces: number }> {
  const existing = await pgPool().query<{ email: string }>("SELECT email FROM users WHERE id = $1", [id]);
  const email = existing.rows[0]?.email;
  if (!email) throw new Error("User not found.");

  const all = await listAllWorkspaces();
  const owned = all.filter((w) => w.ownerId === id);
  const blocked = owned.filter((w) => w.members.some((m) => m.userId !== id));
  if (blocked.length > 0) {
    throw new Error(`This account owns ${blocked.length} workspace(s) with other members (${blocked.map((w) => w.name).join(", ")}). Reassign ownership before deleting it.`);
  }

  for (const w of owned) await adminDeleteWorkspace(w.id);
  await deleteCohortsForCoach(id);

  const memberOfOthers = all.filter((w) => w.ownerId !== id && w.members.some((m) => m.userId === id));
  for (const w of memberOfOthers) await adminRemoveMember(w.id, id);

  await pgPool().query("DELETE FROM users WHERE id = $1", [id]);
  return { email, deletedWorkspaces: owned.length };
}
/** Every account, without the password hash. Admin-only surface (see lib/admin). */
export async function listAllUsers(): Promise<User[]> {
  const res = await pgPool().query<{ id: string; email: string; created_at: Date; disabled: boolean }>(
    "SELECT id, email, created_at, disabled FROM users ORDER BY created_at ASC",
  );
  return res.rows.map((r) => ({ id: r.id, email: r.email, createdAt: r.created_at.toISOString(), disabled: r.disabled }));
}

/**
 * Login lockout (Ch.056): a TWO-TIER guard, persisted so a restart can't reset
 * an attacker's counter. A successful login clears the email's counters.
 *
 *  - Per-(email, ip): LOGIN_MAX_FAILS (5) failures lock that pair. This is the
 *    primary defence and can't be weaponised — an attacker failing a victim's
 *    email locks only the attacker's own IP; the owner, on a different IP, logs
 *    in normally (the email-only lock this replaced let anyone lock a victim out
 *    with five wrong guesses).
 *  - Per-email aggregate: total failures across ALL IPs (the reserved ip
 *    '__all__' row) lock the email once they cross LOGIN_EMAIL_MAX_FAILS (50).
 *    This restores a cap on DISTRIBUTED brute force (a proxy pool rotating IPs),
 *    which per-IP keying alone would leave uncapped. The threshold is set far
 *    above any honest fumbling, so triggering it as a DoS needs ~10 IPs and 50
 *    deliberate failures — a much higher bar than the old five-from-one-IP, and
 *    still time-limited. One IP cycling many emails is separately capped by the
 *    login route's per-IP rate limit.
 */
const LOGIN_MAX_FAILS = 5;
const LOGIN_EMAIL_MAX_FAILS = 50;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
// Reserved ip value for the per-email aggregate row. Can't collide with a real
// client IP or with the legacy '' rows left by the per-ip migration.
const AGG_IP = "__all__";
/** Milliseconds remaining on a lockout for this email — the longer of the
 *  (email, ip) lock and the per-email aggregate lock — or 0 if not locked. */
export async function loginLockRemainingMs(email: string, ip: string): Promise<number> {
  const key = email.trim().toLowerCase();
  const res = await pgPool().query<{ locked_until: string }>(
    "SELECT locked_until FROM login_guard WHERE email = $1 AND ip = ANY($2)",
    [key, [ip, AGG_IP]],
  );
  const lockedUntil = res.rows.reduce((m, r) => Math.max(m, Number(r.locked_until) || 0), 0);
  const rem = lockedUntil - Date.now();
  return rem > 0 ? rem : 0;
}
export async function recordLoginFailure(email: string, ip: string): Promise<void> {
  const key = email.trim().toLowerCase();
  const pool = pgPool();
  const now = Date.now();
  // Tier 1: this (email, ip) pair.
  const per = await pool.query<{ fails: number }>(
    `INSERT INTO login_guard (email, ip, fails) VALUES ($1, $2, 1)
     ON CONFLICT (email, ip) DO UPDATE SET fails = login_guard.fails + 1 RETURNING fails`,
    [key, ip],
  );
  if (per.rows[0]!.fails >= LOGIN_MAX_FAILS) {
    await pool.query("UPDATE login_guard SET locked_until = $3, fails = 0 WHERE email = $1 AND ip = $2", [key, ip, now + LOGIN_LOCKOUT_MS]);
  }
  // Tier 2: the per-email aggregate across all IPs (distributed-attack cap).
  const agg = await pool.query<{ fails: number }>(
    `INSERT INTO login_guard (email, ip, fails) VALUES ($1, $2, 1)
     ON CONFLICT (email, ip) DO UPDATE SET fails = login_guard.fails + 1 RETURNING fails`,
    [key, AGG_IP],
  );
  if (agg.rows[0]!.fails >= LOGIN_EMAIL_MAX_FAILS) {
    await pool.query("UPDATE login_guard SET locked_until = $2, fails = 0 WHERE email = $1 AND ip = $3", [key, now + LOGIN_LOCKOUT_MS, AGG_IP]);
  }
}
/** Clears a locked-out email across every IP — on a successful login (the real
 *  owner just proved themselves) and on admin unlock. */
export async function clearLoginFailures(email: string): Promise<void> {
  const key = email.trim().toLowerCase();
  await pgPool().query("DELETE FROM login_guard WHERE email = $1", [key]);
}

/**
 * Password reset (Ch.11.2.4): a single-use, expiring token per request. Only
 * the SHA-256 hash of the token is stored — like passwords, the raw value
 * exists only in the emailed link, never at rest. Requesting a reset for an
 * unknown email is a silent no-op (the API layer always replies the same way)
 * so the endpoint can't be used to enumerate registered accounts.
 */
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
function hashToken(token: string): string {
  return createHmac("sha256", getSecret()).update(token).digest("hex");
}

/** Returns the raw token to email, or null if the email isn't registered
 *  (caller must still respond identically either way — see the route).
 *  token_hash is the primary key; one active token per email is enforced by
 *  deleting that email's other rows before inserting the new one. */
export async function createResetToken(email: string): Promise<string | null> {
  const e = email.trim().toLowerCase();
  const user = await getUserByEmail(e);
  if (!user) return null;
  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
  const pool = pgPool();
  await pool.query("DELETE FROM reset_tokens WHERE email_lower = $1", [e]);
  await pool.query("INSERT INTO reset_tokens (token_hash, email_lower, expires_at) VALUES ($1, $2, $3)", [tokenHash, e, expiresAt]);
  return token;
}

/** Consumes a reset token and sets the new password. Throws on invalid/expired/weak.
 *  Revokes every existing session for the account — a password reset exists
 *  specifically for "I think someone else has access," so any session
 *  already open (legitimate or not) must not survive it. */
export async function consumeResetToken(token: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
  const tokenHash = hashToken(token);
  const pool = pgPool();
  const res = await pool.query<{ email_lower: string }>(
    "SELECT email_lower FROM reset_tokens WHERE token_hash = $1 AND expires_at > $2", [tokenHash, Date.now()],
  );
  if (!res.rows[0]) throw new Error("This reset link is invalid or has expired.");
  const emailLower = res.rows[0].email_lower;

  const newHash = await hashPassword(newPassword);
  const updateRes = await pool.query<{ id: string }>("UPDATE users SET pass = $2 WHERE email = $1 RETURNING id", [emailLower, newHash]);
  const userId = updateRes.rows[0]?.id;
  if (!userId) throw new Error("This reset link is invalid or has expired.");

  await pool.query("DELETE FROM reset_tokens WHERE token_hash = $1", [tokenHash]);
  await clearLoginFailures(emailLower);
  await revokeOtherSessions(userId, undefined);
}

/** Changes a signed-in user's own password after verifying the current one —
 *  the in-app counterpart to the emailed reset-token flow above, for the
 *  common "I know my password, I just want to change it" case. Revokes
 *  every OTHER session (keeping the one that made this request) — otherwise
 *  a stolen/leaked cookie would keep working indefinitely even after the
 *  legitimate owner changes their password specifically to lock it out. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionId?: string): Promise<void> {
  if (newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
  await withUserRowLock(userId, async (u, client) => {
    if (!(await verifyPassword(currentPassword, u.pass))) throw new Error("Current password is incorrect.");
    const newHash = await hashPassword(newPassword);
    await client.query("UPDATE users SET pass = $2 WHERE id = $1", [userId, newHash]);
  });
  await revokeOtherSessions(userId, keepSessionId);
}

/** Changes a signed-in user's own email after verifying their current
 *  password — same shape as changePassword above (own account, own session,
 *  password re-entry as the confirmation step). No separate verify-link flow:
 *  this instance is local-first and email here is just the login identifier,
 *  not a place mail gets sent unprompted. */
const EMAIL_CHANGE_TTL_MS = 30 * 60 * 1000;

/** Step 1 of changing an email: verify the password, then park a *pending*
 *  change keyed by a hashed token. The email does not change yet — the caller
 *  emails the returned token to the NEW address, and only confirmEmailChange
 *  applies it. Returns the raw token + normalised new email, or throws. */
export async function requestEmailChange(userId: string, currentPassword: string, newEmail: string): Promise<{ token: string; newEmail: string }> {
  const e = newEmail.trim().toLowerCase();
  if (!e || !e.includes("@") || e.includes(" ")) throw new Error("A valid email is required.");
  const pool = pgPool();
  return withUserRowLock(userId, async (u) => {
    if (!(await verifyPassword(currentPassword, u.pass))) throw new Error("Current password is incorrect.");
    if (e === u.email) throw new Error("That's already your email.");
    // Cheap early check; the real guard is the unique constraint at confirm time.
    const taken = await pool.query("SELECT 1 FROM users WHERE email = $1", [e]);
    if (taken.rows[0]) throw new Error("That email is already registered.");
    const token = randomBytes(24).toString("base64url");
    const tokenHash = hashToken(token);
    await pool.query("DELETE FROM pending_email_changes WHERE user_id = $1", [userId]);
    await pool.query(
      "INSERT INTO pending_email_changes (token_hash, user_id, new_email_lower, expires_at) VALUES ($1, $2, $3, $4)",
      [tokenHash, userId, e, Date.now() + EMAIL_CHANGE_TTL_MS],
    );
    return { token, newEmail: e };
  });
}

/** Step 2: consume a verification token and actually change the email. Revokes
 *  every other session — a mail-verified email change is a good moment to drop
 *  any session that might have been opened by whoever had access before. */
export async function confirmEmailChange(token: string): Promise<User> {
  const tokenHash = hashToken(token);
  const pool = pgPool();
  const res = await pool.query<{ user_id: string; new_email_lower: string }>(
    "SELECT user_id, new_email_lower FROM pending_email_changes WHERE token_hash = $1 AND expires_at > $2",
    [tokenHash, Date.now()],
  );
  const row = res.rows[0];
  if (!row) throw new Error("This confirmation link is invalid or has expired.");
  const user = await withUserRowLock(row.user_id, async (u, client) => {
    try {
      await client.query("UPDATE users SET email = $2 WHERE id = $1", [row.user_id, row.new_email_lower]);
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error("That email is now registered to another account.");
      throw err;
    }
    return toPublicUser({ ...u, email: row.new_email_lower });
  });
  await pool.query("DELETE FROM pending_email_changes WHERE token_hash = $1", [tokenHash]);
  await revokeOtherSessions(row.user_id, undefined);
  return user;
}

// A small square JPEG/PNG data URL comfortably fits under 300KB; anything
// bigger is almost certainly a full-res photo someone forgot to resize
// client-side. Reject rather than silently resize server-side — the client
// already resizes before upload.
const MAX_AVATAR_DATA_URL_LENGTH = 300_000;

/** Sets the signed-in user's profile photo. Expects an already-resized
 *  image as a data URL (client does the resizing — see AccountSettingsModal). */
export async function updateAvatar(userId: string, dataUrl: string): Promise<User> {
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(dataUrl)) throw new Error("Must be a PNG, JPEG, or WEBP image.");
  if (dataUrl.length > MAX_AVATAR_DATA_URL_LENGTH) throw new Error("Image is too large — try a smaller photo.");
  return withUserRowLock(userId, async (u, client) => {
    await client.query("UPDATE users SET avatar_url = $2 WHERE id = $1", [userId, dataUrl]);
    return { id: u.id, email: u.email, createdAt: u.createdAt, disabled: u.disabled, avatarUrl: dataUrl };
  });
}
export async function removeAvatar(userId: string): Promise<void> {
  await withUserRowLock(userId, async (_u, client) => {
    await client.query("UPDATE users SET avatar_url = NULL WHERE id = $1", [userId]);
  });
}

/**
 * Two-factor auth (TOTP, see lib/twofa.ts). Setup is two steps on purpose:
 * start2faSetup only stores a PENDING secret — nothing is enforced yet, so
 * leaving mid-setup or scanning the QR wrong can't lock anyone out. Only
 * confirm2fa, after a real 6-digit code proves the app is actually
 * configured, flips twofaEnabled on.
 */
export async function is2faEnabled(userId: string): Promise<boolean> {
  const res = await pgPool().query<{ twofa_enabled: boolean }>("SELECT twofa_enabled FROM users WHERE id = $1", [userId]);
  return !!res.rows[0]?.twofa_enabled;
}
export async function start2faSetup(userId: string, currentPassword: string): Promise<{ secret: string; uri: string }> {
  return withUserRowLock(userId, async (u, client) => {
    if (!(await verifyPassword(currentPassword, u.pass))) throw new Error("Current password is incorrect.");
    const secret = generateTotpSecret();
    await client.query("UPDATE users SET twofa_pending_secret = $2 WHERE id = $1", [userId, secret]);
    return { secret, uri: totpUri(secret, u.email) };
  });
}
/** Confirms setup with a real code from the authenticator app, enables 2FA,
 *  and returns one-time backup codes — shown to the user exactly once. */
export async function confirm2fa(userId: string, token: string): Promise<string[]> {
  return withUserRowLock(userId, async (u, client) => {
    const pending = u.twofaPendingSecret;
    if (!pending) throw new Error("Start setup first — no pending 2FA secret found.");
    if (!verifyTotp(pending, token)) throw new Error("That code doesn't match. Check the time on your device and try again.");
    const backupCodes = generateBackupCodes();
    const hashes = backupCodes.map((c) => hashBackupCode(c, getSecret()));
    await client.query(
      "UPDATE users SET twofa_secret = $2, twofa_enabled = true, twofa_pending_secret = NULL, twofa_backup_hashes = $3 WHERE id = $1",
      [userId, pending, hashes],
    );
    return backupCodes;
  });
}
/** Turns 2FA off. Requires the current password — the same bar as any other
 *  security-reducing account change. */
export async function disable2fa(userId: string, currentPassword: string): Promise<void> {
  await withUserRowLock(userId, async (u, client) => {
    if (!(await verifyPassword(currentPassword, u.pass))) throw new Error("Current password is incorrect.");
    await client.query(
      "UPDATE users SET twofa_secret = NULL, twofa_enabled = false, twofa_pending_secret = NULL, twofa_backup_hashes = NULL WHERE id = $1",
      [userId],
    );
  });
}
/** Checks a login-time 2FA code: either the current TOTP code, or an unused
 *  backup code (which is consumed — single use — on a match). Row-locked for
 *  the duration so two concurrent guesses can't both consume the same backup
 *  code (a real, if narrow, double-spend the old in-process-only lock could
 *  never have prevented across more than one server instance anyway). */
export async function verify2faCode(userId: string, code: string): Promise<boolean> {
  const client = await pgPool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const row = res.rows[0];
    if (!row) { await client.query("ROLLBACK"); return false; }
    const u = rowToStoredUser(row);
    if (!u.twofaEnabled || !u.twofaSecret) { await client.query("ROLLBACK"); return false; }
    if (verifyTotp(u.twofaSecret, code)) { await client.query("COMMIT"); return true; }
    const hashes = u.twofaBackupHashes ?? [];
    const codeHash = hashBackupCode(code, getSecret());
    const matchIdx = hashes.findIndex((h) => h === codeHash);
    if (matchIdx === -1) { await client.query("ROLLBACK"); return false; }
    const remaining = hashes.filter((_, i) => i !== matchIdx);
    await client.query("UPDATE users SET twofa_backup_hashes = $2 WHERE id = $1", [userId, remaining]);
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => { /* connection may already be dead */ });
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Pending-2FA login tokens: a short-lived, single-use token issued after a
 * correct password when the account has 2FA enabled — proves "this request
 * already passed the password check" without yet issuing a real session.
 * The real session (and its cookie) is only created once the 6-digit code
 * also checks out, via consumePending2faLogin + createSession. token_hash is
 * the primary key, targeted SQL per operation.
 */
const PENDING_2FA_TTL_MS = 5 * 60 * 1000;
const MAX_2FA_ATTEMPTS = 5;
export async function createPending2faLogin(userId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await pgPool().query(
    "INSERT INTO pending_2fa (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hashToken(token), userId, Date.now() + PENDING_2FA_TTL_MS],
  );
  return token;
}
/** Consumes (single-use) a pending-2FA token and returns the user id it was
 *  issued for, or null if invalid/expired/already used. */
export async function consumePending2faLogin(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const res = await pgPool().query<{ user_id: string }>(
    "DELETE FROM pending_2fa WHERE token_hash = $1 AND expires_at > $2 RETURNING user_id", [tokenHash, Date.now()],
  );
  return res.rows[0]?.user_id ?? null;
}

/** Checks a 6-digit/backup code against the pending token's account in one
 *  atomic step, WITHOUT burning the token on a wrong guess — only on success
 *  or after MAX_2FA_ATTEMPTS wrong tries (still bounded, and the per-IP rate
 *  limit on the route caps guess speed regardless). The token being
 *  single-use-on-first-try was the original design, but that means one typo
 *  forces the whole login over from the password step, which is a real
 *  usability cost for a security property this already gets from the
 *  attempt cap and the token's own 5-minute expiry. */
export async function verifyPending2faLogin(token: string, code: string): Promise<{ userId: string } | { error: string }> {
  const tokenHash = hashToken(token);
  const pool = pgPool();
  const res = await pool.query<{ user_id: string; attempts: number }>(
    "SELECT user_id, attempts FROM pending_2fa WHERE token_hash = $1 AND expires_at > $2", [tokenHash, Date.now()],
  );
  const row = res.rows[0];
  if (!row) return { error: "This login attempt has expired. Sign in again." };
  const ok = await verify2faCode(row.user_id, code);
  if (ok) {
    await pool.query("DELETE FROM pending_2fa WHERE token_hash = $1", [tokenHash]);
    return { userId: row.user_id };
  }
  const attempts = row.attempts + 1;
  const exhausted = attempts >= MAX_2FA_ATTEMPTS;
  if (exhausted) await pool.query("DELETE FROM pending_2fa WHERE token_hash = $1", [tokenHash]);
  else await pool.query("UPDATE pending_2fa SET attempts = $2 WHERE token_hash = $1", [tokenHash, attempts]);
  return { error: exhausted ? "Too many incorrect attempts. Sign in again." : "Incorrect code." };
}

export const SESSION_COOKIE = "gb_session";
// Set only while an admin is impersonating someone: holds the ADMIN's own
// session token, untouched, so "stop impersonating" can restore it exactly —
// rather than requiring the admin to log back in with their own password
// after every impersonation. gb_session itself becomes the impersonated
// user's token for the duration, so the rest of the app needs zero changes
// to "see" the impersonated user everywhere currentUser() is called.
export const IMPERSONATOR_COOKIE = "gb_impersonator";

// Secure is unconditional, not gated on NODE_ENV: browsers exempt
// "localhost" from the Secure-requires-HTTPS rule, so local dev over
// http://localhost is unaffected — this only ever tightens the cookie,
// never breaks it, so there's no reason to special-case dev.
function cookieValue(name: string, token: string, maxAgeSec: number): string {
  return `${name}=${token}; HttpOnly; Secure; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
}
function clearCookieValue(name: string): string {
  return `${name}=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Lax`;
}
function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const c = cookieHeader.split(/;\s*/).find((x) => x.startsWith(`${name}=`));
  return c ? c.slice(name.length + 1) : null;
}

export function sessionCookie(token: string, maxAgeSec = 30 * 24 * 3600): string { return cookieValue(SESSION_COOKIE, token, maxAgeSec); }
export function clearSessionCookie(): string { return clearCookieValue(SESSION_COOKIE); }
export function readSessionToken(cookieHeader: string | null): string | null { return readCookie(cookieHeader, SESSION_COOKIE); }

export function impersonatorCookie(token: string, maxAgeSec = 30 * 24 * 3600): string { return cookieValue(IMPERSONATOR_COOKIE, token, maxAgeSec); }
export function clearImpersonatorCookie(): string { return clearCookieValue(IMPERSONATOR_COOKIE); }
export function readImpersonatorToken(cookieHeader: string | null): string | null { return readCookie(cookieHeader, IMPERSONATOR_COOKIE); }

/** Resolve the current user from a request's Cookie header, or null. A
 *  disabled account resolves to null here too — deactivating a user ends
 *  their existing sessions immediately, not just future login attempts.
 *  Also honors server-side session revocation (see resolveSession). */
export async function currentUser(cookieHeader: string | null): Promise<User | null> {
  const uid = await resolveSession(readSessionToken(cookieHeader));
  if (!uid) return null;
  const user = await getUserById(uid);
  return user && !user.disabled ? user : null;
}

/** The session id (not user id) behind the current request's cookie, if the
 *  token carries one. Used to mark "this device" in the sessions list and to
 *  exclude the current session from "log out everywhere else". */
export function currentSessionId(cookieHeader: string | null): string | null {
  return decodeSessionToken(readSessionToken(cookieHeader))?.sid ?? null;
}
/** Same as currentSessionId, but for an arbitrary raw token — e.g. the
 *  gb_impersonator cookie, which isn't the main session cookie. */
export function sessionIdFromToken(token: string | null | undefined): string | null {
  return decodeSessionToken(token)?.sid ?? null;
}

/** If this request is inside an admin's impersonation session, resolve who
 *  the ADMIN actually is (not who they're currently appearing as). Null when
 *  there's no impersonation in progress. Uses resolveSession (not the bare
 *  signature+expiry check verifySession does) so that revoking the parked
 *  admin session — e.g. "log out this device" fired from another tab while
 *  an impersonation is in progress — actually ends the impersonation too,
 *  instead of letting stop-impersonating silently restore a session that
 *  was supposed to be dead. */
export async function currentImpersonator(cookieHeader: string | null): Promise<User | null> {
  const uid = await resolveSession(readImpersonatorToken(cookieHeader));
  return uid ? getUserById(uid) : null;
}
