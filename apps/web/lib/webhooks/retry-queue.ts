/**
 * Retry queue + dead-letter handling for outbound webhook delivery, backed by
 * webhook_delivery_queue (see the migration for how this relates to the
 * existing outbound_webhooks/webhook_deliveries tables in lib/webhooks.ts).
 *
 * Lifecycle of one row: enqueueWebhook() inserts it 'pending' with
 * next_retry_at = now(). processRetryQueue() — meant to be ticked
 * periodically, same shape as runDueJobs()/dispatchDueBroadcasts() in
 * lib/jobs.ts — claims due rows, hands each to deliverWebhook() (./delivery),
 * and on the outcome either marks it 'delivered', reschedules it 'pending'
 * with the next backoff delay, or moves it to 'dead_letter' once
 * MAX_ATTEMPTS is reached. Wiring this into the actual job tick, and routing
 * dispatchEvent()/Stripe events through enqueueWebhook() instead of firing
 * inline, is Wave 4 — this module is the standalone foundation for that.
 *
 * Concurrency: claiming uses the same atomic
 * "UPDATE ... WHERE status = 'pending' ... RETURNING" pattern as
 * dispatchDueBroadcasts (lib/outreach/broadcasts.ts) rather than an advisory
 * lock — Postgres's own row-level locking makes the WHERE clause a safe
 * single-winner check under concurrent ticks, and each row is independent so
 * there's no cross-row deadlock risk to guard against. A row can get stuck in
 * 'processing' if a container dies mid-delivery; reclaimStalled() un-sticks
 * it on the next tick, same idea as broadcasts' reclaimStrandedBroadcasts.
 */
import { pgPool } from "../db";
import { deliverWebhook, type WebhookQueueItem } from "./delivery";

export type WebhookQueueStatus = "pending" | "processing" | "delivered" | "dead_letter";

export interface QueuedWebhook extends WebhookQueueItem {
  status: WebhookQueueStatus;
  nextRetryAt?: string;
  failedAt?: string;
  deliveredAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

interface QueueRow {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  target_url: string;
  attempt_count: number;
  status: string;
  next_retry_at: Date | null;
  failed_at: Date | null;
  delivered_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

function rowToQueued(r: QueueRow): QueuedWebhook {
  return {
    id: String(r.id),
    eventType: r.event_type,
    payload: r.payload,
    targetUrl: r.target_url,
    attemptCount: r.attempt_count,
    status: r.status as WebhookQueueStatus,
    ...(r.next_retry_at ? { nextRetryAt: r.next_retry_at.toISOString() } : {}),
    ...(r.failed_at ? { failedAt: r.failed_at.toISOString() } : {}),
    ...(r.delivered_at ? { deliveredAt: r.delivered_at.toISOString() } : {}),
    ...(r.last_error ? { lastError: r.last_error } : {}),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

/** How long after attempt N fails to wait before attempt N+1. Only attempts
 *  1-4 get a scheduled backoff; a 5th failure exhausts MAX_ATTEMPTS and moves
 *  straight to dead_letter, so there's no "delay before attempt 6". */
const BACKOFF_MS_BY_ATTEMPT: Readonly<Record<number, number>> = {
  1: 5 * 60_000,
  2: 15 * 60_000,
  3: 60 * 60_000,
  4: 24 * 60 * 60_000,
};
export const MAX_ATTEMPTS = 5;

/** How many due rows one processRetryQueue() call works off. Bounded so a
 *  huge backlog can't turn one tick into an unbounded-length run — same
 *  reasoning as dispatchDueBroadcasts's LIMIT 100. */
const BATCH_LIMIT = 50;

/** A 'processing' row older than this has outlived deliverWebhook's own 10s
 *  timeout many times over — its worker died mid-attempt (crash, container
 *  reclaim) rather than being merely slow. Generous on purpose: it only
 *  needs to be bigger than any real in-flight attempt, not tight. */
const STALL_MS = 2 * 60_000;

export interface EnqueueEvent {
  type: string;
  payload: Record<string, unknown>;
}

/** Queues one delivery. Never validates target_url's safety itself — see the
 *  module docstring; that's the calling route's job at registration time,
 *  the same split lib/url-safety.ts documents for createWebhook. The real,
 *  always-on runtime guard is deliverWebhook's SSRF pin at send time. */
export async function enqueueWebhook(event: EnqueueEvent, targetUrl: string): Promise<QueuedWebhook> {
  const res = await pgPool().query<QueueRow>(
    `INSERT INTO webhook_delivery_queue (event_type, payload, target_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [event.type, JSON.stringify(event.payload), targetUrl],
  );
  return rowToQueued(res.rows[0]!);
}

/** Un-stick rows abandoned mid-delivery back to 'pending' so they're picked
 *  up again instead of sitting in 'processing' forever. Returns how many were
 *  reclaimed (for the run summary, not that callers need to act on it). */
async function reclaimStalled(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - STALL_MS).toISOString();
  const res = await pgPool().query(
    `UPDATE webhook_delivery_queue SET status = 'pending', updated_at = now()
     WHERE status = 'processing' AND updated_at < $1`,
    [cutoff],
  );
  return res.rowCount ?? 0;
}

export interface RetryQueueRunSummary {
  reclaimed: number;
  delivered: number;
  retried: number;
  deadLettered: number;
}

type AddressValidator = (address: string, family: number) => boolean;

/** Works off every due row (status='pending', next_retry_at <= now), up to
 *  BATCH_LIMIT. Never throws — one bad row is isolated (caught, skipped) so
 *  it can't stop the rest of the batch from being worked, mirroring
 *  dispatchDueBroadcasts. `now`/`allowAddress` are injectable for tests (a
 *  fixed clock to assert exact backoff timestamps; a permissive address
 *  validator to reach a loopback mock receiver) — production call sites
 *  should pass neither and take the defaults. */
export async function processRetryQueue(now: Date = new Date(), allowAddress?: AddressValidator): Promise<RetryQueueRunSummary> {
  const pool = pgPool();
  const reclaimed = await reclaimStalled(now).catch(() => 0);

  const due = await pool.query<{ id: string }>(
    `SELECT id FROM webhook_delivery_queue WHERE status = 'pending' AND next_retry_at <= $1 ORDER BY next_retry_at ASC LIMIT $2`,
    [now.toISOString(), BATCH_LIMIT],
  );

  let delivered = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const { id } of due.rows) {
    try {
      const claim = await pool.query<QueueRow>(
        `UPDATE webhook_delivery_queue SET status = 'processing', updated_at = now() WHERE id = $1 AND status = 'pending' RETURNING *`,
        [id],
      );
      if (claim.rowCount === 0) continue; // another tick already claimed it
      const row = rowToQueued(claim.rows[0]!);

      const result = await deliverWebhook(row, allowAddress);
      const attemptCount = row.attemptCount + 1;

      if (result.ok) {
        await pool.query(
          `UPDATE webhook_delivery_queue SET status = 'delivered', attempt_count = $2, delivered_at = now(), last_error = NULL, updated_at = now() WHERE id = $1`,
          [id, attemptCount],
        );
        delivered++;
        continue;
      }

      const lastError = result.error ?? `destination responded ${result.status ?? "no status"}`;
      if (attemptCount >= MAX_ATTEMPTS) {
        await pool.query(
          `UPDATE webhook_delivery_queue SET status = 'dead_letter', attempt_count = $2, failed_at = now(), last_error = $3, updated_at = now() WHERE id = $1`,
          [id, attemptCount, lastError],
        );
        deadLettered++;
      } else {
        const delayMs = BACKOFF_MS_BY_ATTEMPT[attemptCount] ?? BACKOFF_MS_BY_ATTEMPT[4]!;
        const nextRetryAt = new Date(now.getTime() + delayMs).toISOString();
        await pool.query(
          `UPDATE webhook_delivery_queue SET status = 'pending', attempt_count = $2, next_retry_at = $3, last_error = $4, updated_at = now() WHERE id = $1`,
          [id, attemptCount, nextRetryAt, lastError],
        );
        retried++;
      }
    } catch { /* isolate: a bad row must not stop the rest of the batch */ }
  }

  return { reclaimed, delivered, retried, deadLettered };
}

export interface WebhookQueueCounts {
  pending: number;
  failed: number;
  deadLetter: number;
  delivered: number;
}

/** Cheap totals for the admin summary, independent of any list's LIMIT.
 *  "pending" vs "failed" is a display-only split of the same underlying
 *  pending/processing rows — see webhookQueueOverview for why. */
export async function webhookQueueCounts(): Promise<WebhookQueueCounts> {
  const res = await pgPool().query<{ pending: string; failed: string; dead_letter: string; delivered: string }>(
    `SELECT
       count(*) FILTER (WHERE status IN ('pending', 'processing') AND attempt_count = 0) AS pending,
       count(*) FILTER (WHERE status IN ('pending', 'processing') AND attempt_count > 0) AS failed,
       count(*) FILTER (WHERE status = 'dead_letter') AS dead_letter,
       count(*) FILTER (WHERE status = 'delivered') AS delivered
     FROM webhook_delivery_queue`,
  );
  const r = res.rows[0]!;
  return { pending: Number(r.pending), failed: Number(r.failed), deadLetter: Number(r.dead_letter), delivered: Number(r.delivered) };
}

export interface WebhookQueueOverview {
  /** Never attempted yet (attempt_count = 0). */
  pending: QueuedWebhook[];
  /** Failed at least once, waiting out its backoff for the next attempt. */
  failed: QueuedWebhook[];
  /** Exhausted MAX_ATTEMPTS — needs a manual retry or investigation. */
  deadLetter: QueuedWebhook[];
  /** Recently succeeded, for context next to the trouble spots above. */
  delivered: QueuedWebhook[];
}

/** The admin webhook-status view's data: pending / failed / dead-letter,
 *  split the way an operator actually thinks about the queue rather than by
 *  the DB's internal pending+processing status pair. `limit` bounds each
 *  list independently; use webhookQueueCounts() for totals that aren't
 *  truncated by it. */
export async function webhookQueueOverview(limit = 100): Promise<WebhookQueueOverview> {
  const pool = pgPool();
  const cap = Math.max(1, Math.min(limit, 500));
  const [pending, failed, deadLetter, delivered] = await Promise.all([
    pool.query<QueueRow>(`SELECT * FROM webhook_delivery_queue WHERE status IN ('pending', 'processing') AND attempt_count = 0 ORDER BY next_retry_at ASC LIMIT $1`, [cap]),
    pool.query<QueueRow>(`SELECT * FROM webhook_delivery_queue WHERE status IN ('pending', 'processing') AND attempt_count > 0 ORDER BY next_retry_at ASC LIMIT $1`, [cap]),
    pool.query<QueueRow>(`SELECT * FROM webhook_delivery_queue WHERE status = 'dead_letter' ORDER BY failed_at DESC LIMIT $1`, [cap]),
    pool.query<QueueRow>(`SELECT * FROM webhook_delivery_queue WHERE status = 'delivered' ORDER BY delivered_at DESC LIMIT $1`, [cap]),
  ]);
  return {
    pending: pending.rows.map(rowToQueued),
    failed: failed.rows.map(rowToQueued),
    deadLetter: deadLetter.rows.map(rowToQueued),
    delivered: delivered.rows.map(rowToQueued),
  };
}

/** Manual retry for one dead-lettered row (the admin "retry" button): resets
 *  it to a clean 'pending' state with a full fresh attempt budget and an
 *  immediate next_retry_at, so the next processRetryQueue tick picks it up
 *  like any other due delivery instead of re-dead-lettering on one failure.
 *  Only matches status='dead_letter' — retrying a row that's already
 *  pending/processing/delivered would be a no-op at best and a race with a
 *  concurrent tick at worst, so those are left untouched. Returns whether a
 *  row actually matched, so the route can 404 on a bad id instead of a
 *  silent success. */
export async function retryDeadLetteredWebhook(id: string): Promise<boolean> {
  const res = await pgPool().query(
    `UPDATE webhook_delivery_queue
     SET status = 'pending', attempt_count = 0, next_retry_at = now(), failed_at = NULL, last_error = NULL, updated_at = now()
     WHERE id = $1 AND status = 'dead_letter'`,
    [id],
  );
  return (res.rowCount ?? 0) > 0;
}
