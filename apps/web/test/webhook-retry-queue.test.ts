import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { pgPool } from "../lib/db";
import {
  enqueueWebhook,
  processRetryQueue,
  webhookQueueCounts,
  webhookQueueOverview,
  retryDeadLetteredWebhook,
  MAX_ATTEMPTS,
} from "../lib/webhooks/retry-queue";
import { deliverWebhook } from "../lib/webhooks/delivery";
import { uid } from "./helpers/pg";

const PREFIX = uid("webhook-retry-test");
let seq = 0;
const eventType = () => `${PREFIX}-${seq++}`;

// These tests deliver to loopback mock receivers, which the production SSRF
// pin (rightly) blocks — same rationale as test/webhooks.test.ts. The pin
// itself is covered by url-safety's and safe-fetch's own tests.
const allowLoopback = () => true;

after(async () => {
  await pgPool().query("DELETE FROM webhook_delivery_queue WHERE event_type LIKE $1", [`${PREFIX}%`]);
});

// processRetryQueue sweeps ALL due rows in the table, by design (that's the
// correct real-world behaviour for a shared queue). So a row left 'pending'
// or 'processing' by one test is a live landmine for any later test in this
// same run that advances the clock far enough for it to become due too,
// inflating that later test's summary counts nondeterministically (exactly
// how fast the suite runs decides which leftovers coincide with which
// simulated `now`). deleteRow lets every test that doesn't drive its row to
// a terminal state clean up after itself, so tests stay order-independent
// regardless of machine speed. Per-row assertions (query by id) are used as
// the authoritative check throughout for the same reason — never trust an
// aggregate count to mean "just mine".
async function deleteRow(id: string): Promise<void> {
  await pgPool().query("DELETE FROM webhook_delivery_queue WHERE id = $1", [id]);
}

async function withReceiver(status: number): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => res.writeHead(status).end());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { url: `http://127.0.0.1:${port}/hook`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

test("enqueueWebhook: inserts a pending row with attempt_count 0", async () => {
  const type = eventType();
  const item = await enqueueWebhook({ type, payload: { foo: "bar" } }, "https://example.invalid/hook");
  try {
    assert.equal(item.status, "pending");
    assert.equal(item.attemptCount, 0);
    assert.equal(item.eventType, type);
    assert.deepEqual(item.payload, { foo: "bar" });
  } finally { await deleteRow(item.id); }
});

test("deliverWebhook: success is reported ok with the response status", async () => {
  const receiver = await withReceiver(200);
  try {
    const result = await deliverWebhook({ id: "x", eventType: "t", payload: { a: 1 }, targetUrl: receiver.url, attemptCount: 0 }, allowLoopback);
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
  } finally { await receiver.close(); }
});

test("deliverWebhook: a redirect is treated as a blocked delivery, not success", async () => {
  const server = createServer((_req, res) => { res.writeHead(302, { location: "http://127.0.0.1/elsewhere" }).end(); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    const result = await deliverWebhook({ id: "x", eventType: "t", payload: {}, targetUrl: `http://127.0.0.1:${port}/hook`, attemptCount: 0 }, allowLoopback);
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /redirect/);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test("processRetryQueue: a successful delivery marks the row delivered", async () => {
  const receiver = await withReceiver(200);
  let id: string | undefined;
  try {
    const item = await enqueueWebhook({ type: eventType(), payload: { hello: "world" } }, receiver.url);
    id = item.id;
    const t0 = new Date(Date.now() + 5_000); // comfortably past the DB's real insert-time next_retry_at
    await processRetryQueue(t0, allowLoopback);

    const res = await pgPool().query<{ status: string; attempt_count: number; delivered_at: Date | null }>(
      "SELECT status, attempt_count, delivered_at FROM webhook_delivery_queue WHERE id = $1", [item.id],
    );
    const row = res.rows[0];
    assert.ok(row);
    assert.equal(row.status, "delivered");
    assert.equal(row.attempt_count, 1);
    assert.ok(row.delivered_at);
  } finally {
    await receiver.close();
    if (id) await deleteRow(id); // terminal already, but tidy up rather than rely on the file-level sweep
  }
});

test("processRetryQueue: a failing delivery reschedules with the 5-minute backoff after attempt 1, and isn't due before then", async () => {
  const receiver = await withReceiver(500);
  let id: string | undefined;
  try {
    const item = await enqueueWebhook({ type: eventType(), payload: {} }, receiver.url);
    id = item.id;
    const t0 = new Date(Date.now() + 5_000);
    await processRetryQueue(t0, allowLoopback);

    const res = await pgPool().query<{ status: string; attempt_count: number; next_retry_at: Date; last_error: string | null }>(
      "SELECT status, attempt_count, next_retry_at, last_error FROM webhook_delivery_queue WHERE id = $1", [item.id],
    );
    const row = res.rows[0];
    assert.ok(row);
    assert.equal(row.status, "pending");
    assert.equal(row.attempt_count, 1);
    assert.equal(new Date(row.next_retry_at).getTime(), t0.getTime() + 5 * 60_000);
    assert.match(row.last_error ?? "", /500/);

    // Still at t0 (before the 5-minute backoff elapses) — this row specifically must not move.
    await processRetryQueue(t0, allowLoopback);
    const stillWaiting = await pgPool().query<{ attempt_count: number }>(
      "SELECT attempt_count FROM webhook_delivery_queue WHERE id = $1", [item.id],
    );
    const waitRow = stillWaiting.rows[0];
    assert.ok(waitRow);
    assert.equal(waitRow.attempt_count, 1, "must not have been re-attempted before its backoff elapsed");
  } finally {
    await receiver.close();
    if (id) await deleteRow(id);
  }
});

test(`processRetryQueue: exhausting ${MAX_ATTEMPTS} attempts on the exact backoff schedule moves the row to dead_letter`, async () => {
  const receiver = await withReceiver(503);
  let id: string | undefined;
  try {
    const item = await enqueueWebhook({ type: eventType(), payload: {} }, receiver.url);
    id = item.id;
    const backoffMinutes = [5, 15, 60, 24 * 60]; // matches BACKOFF_MS_BY_ATTEMPT for attempts 1-4
    let now = new Date(Date.now() + 5_000);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await processRetryQueue(now, allowLoopback);
      const res = await pgPool().query<{ status: string; attempt_count: number; next_retry_at: Date | null; failed_at: Date | null }>(
        "SELECT status, attempt_count, next_retry_at, failed_at FROM webhook_delivery_queue WHERE id = $1", [item.id],
      );
      const row = res.rows[0];
      assert.ok(row);
      assert.equal(row.attempt_count, attempt, `attempt_count after attempt ${attempt}`);
      if (attempt < MAX_ATTEMPTS) {
        const backoff = backoffMinutes[attempt - 1]!;
        assert.equal(row.status, "pending", `attempt ${attempt} should reschedule, not dead-letter`);
        assert.equal(new Date(row.next_retry_at!).getTime(), now.getTime() + backoff * 60_000);
        now = new Date(now.getTime() + backoff * 60_000);
      } else {
        assert.equal(row.status, "dead_letter", "the final attempt should dead-letter");
        assert.ok(row.failed_at);
      }
    }
  } finally {
    await receiver.close();
    if (id) await deleteRow(id);
  }
});

test("processRetryQueue: reclaims a row stuck in 'processing' past the stall window", async () => {
  const item = await enqueueWebhook({ type: eventType(), payload: {} }, "https://example.invalid/never-reached");
  try {
    const now = new Date(Date.now() + 5_000);
    // Simulate a worker that claimed this row and then died mid-delivery: stuck
    // 'processing' with a heartbeat old enough to count as stalled (STALL_MS).
    await pgPool().query(
      "UPDATE webhook_delivery_queue SET status = 'processing', updated_at = $2 WHERE id = $1",
      [item.id, new Date(now.getTime() - 10 * 60_000).toISOString()],
    );

    await processRetryQueue(now, allowLoopback);
    const res = await pgPool().query<{ status: string }>("SELECT status FROM webhook_delivery_queue WHERE id = $1", [item.id]);
    const row = res.rows[0];
    assert.ok(row);
    // Reclaimed back to 'pending', and — since it was due — immediately swept
    // into the very same tick's delivery attempt, which fails (never-reached
    // target) and reschedules it: either outcome proves the reclaim worked.
    assert.notEqual(row.status, "processing");
  } finally { await deleteRow(item.id); }
});

test("webhookQueueCounts/webhookQueueOverview: bucket pending (never tried) separately from failed (retrying) and delivered", async () => {
  const okReceiver = await withReceiver(200);
  const failReceiver = await withReceiver(500);
  const ids: string[] = [];
  try {
    const failing = await enqueueWebhook({ type: eventType(), payload: {} }, failReceiver.url);
    const ok = await enqueueWebhook({ type: eventType(), payload: {} }, okReceiver.url);
    ids.push(failing.id, ok.id);
    await processRetryQueue(new Date(Date.now() + 5_000), allowLoopback); // delivers `ok`, fails+reschedules `failing`

    // Enqueued only AFTER the tick above, so it's untouched: a true "never tried" pending row.
    const fresh = await enqueueWebhook({ type: eventType(), payload: {} }, "https://example.invalid/never-reached");
    ids.push(fresh.id);

    const counts = await webhookQueueCounts();
    assert.ok(counts.pending >= 1);
    assert.ok(counts.failed >= 1);
    assert.ok(counts.delivered >= 1);

    const overview = await webhookQueueOverview();
    assert.ok(overview.pending.some((q) => q.id === fresh.id), "fresh, untried row should be in `pending`");
    assert.ok(!overview.failed.some((q) => q.id === fresh.id), "fresh row should not be in `failed`");
    assert.ok(overview.failed.some((q) => q.id === failing.id), "a row that failed once should be in `failed`, not `pending`");
    assert.ok(!overview.pending.some((q) => q.id === failing.id));
    assert.ok(overview.delivered.some((q) => q.id === ok.id));
  } finally {
    await okReceiver.close();
    await failReceiver.close();
    for (const id of ids) await deleteRow(id);
  }
});

test("retryDeadLetteredWebhook: resets a dead-lettered row to pending with a fresh attempt budget, and refuses anything else", async () => {
  const item = await enqueueWebhook({ type: eventType(), payload: {} }, "https://example.invalid/never-reached");
  const stillPending = await enqueueWebhook({ type: eventType(), payload: {} }, "https://example.invalid/never-reached");
  try {
    await pgPool().query(
      "UPDATE webhook_delivery_queue SET status = 'dead_letter', attempt_count = $2, failed_at = now(), last_error = 'boom' WHERE id = $1",
      [item.id, MAX_ATTEMPTS],
    );

    assert.equal(await retryDeadLetteredWebhook(item.id), true);

    const res = await pgPool().query<{ status: string; attempt_count: number; next_retry_at: Date | null; failed_at: Date | null; last_error: string | null }>(
      "SELECT status, attempt_count, next_retry_at, failed_at, last_error FROM webhook_delivery_queue WHERE id = $1", [item.id],
    );
    const row = res.rows[0];
    assert.ok(row);
    assert.equal(row.status, "pending");
    assert.equal(row.attempt_count, 0);
    assert.equal(row.failed_at, null);
    assert.equal(row.last_error, null);
    assert.ok(row.next_retry_at);

    // A row that ISN'T dead-lettered refuses the manual retry (no-op, false).
    assert.equal(await retryDeadLetteredWebhook(stillPending.id), false);
  } finally {
    await deleteRow(item.id);
    await deleteRow(stillPending.id);
  }
});
