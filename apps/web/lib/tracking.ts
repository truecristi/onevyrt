/**
 * Live tracking ingest (Ch.052): real visit/conversion events from a funnel's
 * pages roll up into per-node counts, which the studio pulls in as "actuals"
 * to feed the Reality Loop. Postgres-backed (see lib/db.ts).
 *
 * A tracking KEY is a public token minted for a (workspace, project) pair — safe
 * to embed in a public page because it can only *append* counts, never read
 * private data. Events are aggregated on write (running counts, not a raw log)
 * so storage stays bounded no matter the traffic volume.
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "./db";

export type EventType = "visit" | "convert";
export interface NodeCount { visits: number; conversions: number; revenue: number; }
export type Counts = Record<string, NodeCount>;

/** Get the existing tracking key for a (workspace, project), or mint one. Idempotent. */
export async function ensureTrackingKey(scopeKey: string, projectId: string): Promise<string> {
  const pool = pgPool();
  const existing = await pool.query<{ key: string }>(
    "SELECT key FROM tracking_keys WHERE scope_key = $1 AND project_id = $2 LIMIT 1",
    [scopeKey, projectId],
  );
  if (existing.rows[0]) return existing.rows[0].key;
  const key = randomBytes(9).toString("base64url");
  await pool.query("INSERT INTO tracking_keys (key, scope_key, project_id) VALUES ($1, $2, $3)", [key, scopeKey, projectId]);
  return key;
}
export async function resolveTrackingKey(key: string): Promise<{ scopeKey: string; projectId: string } | null> {
  const res = await pgPool().query<{ scope_key: string; project_id: string }>(
    "SELECT scope_key, project_id FROM tracking_keys WHERE key = $1", [key],
  );
  const row = res.rows[0];
  return row ? { scopeKey: row.scope_key, projectId: row.project_id } : null;
}

// The counter map is meant to hold one entry per real canvas node (a
// handful, typically under 20) — nodeId is client-supplied and otherwise
// unbounded, so without a cap a held tracking key could grow this table
// forever by sending a different fake nodeId on every request.
const MAX_NODE_ID_LEN = 128;
const MAX_DISTINCT_NODES = 200;

/** Append one event to the running counts for a key. Returns false if the key is unknown.
 *  tracking_counts is a real per-(key, node_id) row, so Postgres does the
 *  increment atomically via ON CONFLICT DO UPDATE. */
export async function recordEvent(key: string, nodeId: string, type: EventType, value = 0): Promise<boolean> {
  if (!nodeId || (type !== "visit" && type !== "convert")) return false;
  if (!(await resolveTrackingKey(key))) return false;
  const id = nodeId.slice(0, MAX_NODE_ID_LEN);
  const pool = pgPool();
  const exists = await pool.query("SELECT 1 FROM tracking_counts WHERE key = $1 AND node_id = $2", [key, id]);
  if (exists.rowCount === 0) {
    const countRes = await pool.query("SELECT count(*) FROM tracking_counts WHERE key = $1", [key]);
    if (Number(countRes.rows[0].count) >= MAX_DISTINCT_NODES) return false;
  }
  const visitInc = type === "visit" ? 1 : 0;
  const convInc = type === "convert" ? 1 : 0;
  const revInc = type === "convert" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  await pool.query(
    `INSERT INTO tracking_counts (key, node_id, visits, conversions, revenue) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (key, node_id) DO UPDATE SET
       visits = tracking_counts.visits + $3, conversions = tracking_counts.conversions + $4, revenue = tracking_counts.revenue + $5`,
    [key, id, visitInc, convInc, revInc],
  );
  return true;
}

export async function getEventCounts(key: string): Promise<Counts> {
  const res = await pgPool().query<{ node_id: string; visits: number; conversions: number; revenue: number }>(
    "SELECT node_id, visits, conversions, revenue FROM tracking_counts WHERE key = $1", [key],
  );
  const counts: Counts = {};
  for (const r of res.rows) counts[r.node_id] = { visits: r.visits, conversions: r.conversions, revenue: r.revenue };
  return counts;
}
/** Reset counts for a key (e.g. starting a fresh measurement period). */
export async function resetCounts(key: string): Promise<void> {
  await pgPool().query("DELETE FROM tracking_counts WHERE key = $1", [key]);
}

/**
 * Journey log: the raw, per-session event trail that feeds traffic-explorer.ts
 * (discoverNextSteps/discoverPreviousSteps/discoverSources/stepConversion).
 * Deliberately separate from the aggregated visit/conversion counts above —
 * those stay a bounded running total no matter the traffic volume; this is a
 * capped raw log (oldest sessions drop off) since the whole point is to
 * preserve individual sequences, not just totals. Written best-effort from
 * the same /api/track ingest the simple counter already uses — the embed
 * snippet's automatic sessionId means existing installs get this for free.
 * Kept as one jsonb blob per key (nested session/event caps are easier to
 * enforce in JS than in SQL, and this data is already explicitly
 * best-effort) — guarded by an in-process lock keyed per tracking key, since
 * a concurrent read-modify-write on the SAME key's session array is the real
 * race (different keys never contend with each other).
 */
const MAX_JOURNEY_SESSIONS = 300;
// A single session pinned to one sessionId had no cap of its own — only the
// *number of sessions* was bounded, so a held key could grow one session's
// event array forever by reusing the same sessionId on every request.
const MAX_EVENTS_PER_SESSION = 500;
const MAX_FIELD_LEN = 512;
const trim = (s: string): string => s.slice(0, MAX_FIELD_LEN);

export interface JourneyEventRecord {
  id: string;
  timestamp: number;
  type: "pageview" | "click" | "conversion" | "custom";
  url?: string;
  sourceLabel?: string;
  nodeId?: string;
  label?: string;
}
export interface JourneySessionRecord {
  id: string;
  personId?: string;
  deviceType?: "desktop" | "mobile" | "tablet";
  country?: string;
  events: JourneyEventRecord[];
}
export interface JourneyEventInput {
  sessionId: string;
  type: "pageview" | "click" | "conversion" | "custom";
  url?: string;
  sourceLabel?: string;
  nodeId?: string;
  label?: string;
  personId?: string;
  deviceType?: "desktop" | "mobile" | "tablet";
  country?: string;
}

async function readJourneys(key: string): Promise<JourneySessionRecord[]> {
  const res = await pgPool().query<{ sessions: JourneySessionRecord[] }>("SELECT sessions FROM tracking_journeys WHERE key = $1", [key]);
  return res.rows[0]?.sessions ?? [];
}

/** Appends one event to a session's journey, creating the session on first
 *  sight. Best-effort by design — a malformed sessionId should never break
 *  the simple visit/conversion counter it rides alongside. */
export async function recordJourneyEvent(key: string, input: JourneyEventInput): Promise<boolean> {
  if (!input.sessionId || !(await resolveTrackingKey(key))) return false;
  // Serialize the read-modify-write of this key's sessions jsonb with a
  // Postgres transaction-scoped advisory lock rather than a per-process file
  // lock: the DB lock coordinates across every app instance, so running more
  // than one container (horizontal scaling — see RUNBOOK) can't lose updates.
  const client = await pgPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`journeys:${key}`]);
    const res = await client.query<{ sessions: JourneySessionRecord[] }>("SELECT sessions FROM tracking_journeys WHERE key = $1", [key]);
    let sessions = res.rows[0]?.sessions ?? [];
    let session = sessions.find((s) => s.id === input.sessionId.slice(0, MAX_FIELD_LEN));
    if (!session) {
      session = { id: input.sessionId.slice(0, MAX_FIELD_LEN), events: [], ...(input.personId ? { personId: trim(input.personId) } : {}), ...(input.deviceType ? { deviceType: input.deviceType } : {}), ...(input.country ? { country: trim(input.country) } : {}) };
      sessions.push(session);
    }
    session.events.push({
      id: randomBytes(6).toString("hex"), timestamp: Date.now(), type: input.type,
      ...(input.url ? { url: trim(input.url) } : {}), ...(input.sourceLabel ? { sourceLabel: trim(input.sourceLabel) } : {}),
      ...(input.nodeId ? { nodeId: trim(input.nodeId) } : {}), ...(input.label ? { label: trim(input.label) } : {}),
    });
    if (session.events.length > MAX_EVENTS_PER_SESSION) session.events = session.events.slice(session.events.length - MAX_EVENTS_PER_SESSION);
    if (sessions.length > MAX_JOURNEY_SESSIONS) sessions = sessions.slice(sessions.length - MAX_JOURNEY_SESSIONS);
    await client.query(
      `INSERT INTO tracking_journeys (key, sessions) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET sessions = EXCLUDED.sessions`,
      [key, JSON.stringify(sessions)],
    );
    await client.query("COMMIT");
    return true;
  } catch {
    await client.query("ROLLBACK").catch(() => { /* best-effort */ });
    return false;
  } finally {
    client.release();
  }
}

/** Most recent sessions first — for the People Journeys panel. */
export async function getJourneySessions(key: string, limit = 20): Promise<JourneySessionRecord[]> {
  const sessions = await readJourneys(key);
  return sessions.slice(-limit).reverse();
}
