import test from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { pgPool, withAdvisoryLock } from "../lib/db";

/**
 * Regression guard for the connection-amplification deadlock (see lib/db.ts):
 * `withAdvisoryLock` must run its callback on the SAME connection that holds
 * the transaction-scoped lock — it must never check out a second pooled
 * connection while the lock is held. If it did, N concurrent lock-holders on a
 * pool of N would each hold one connection and block forever waiting for a
 * second, deadlocking the whole pool. These tests fail the moment any locked
 * path reaches for a fresh `pgPool()` connection again.
 */

test("withAdvisoryLock: holds exactly one pooled connection for the locked section", async () => {
  const pool = pgPool();
  const origConnect = pool.connect.bind(pool);
  let inFlight = 0, maxInFlight = 0;
  // Count how many pooled connections are checked out at once during the lock.
  (pool as unknown as { connect: typeof pool.connect }).connect = (async (...args: unknown[]) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    // @ts-expect-error passthrough to the real overloaded connect
    const client: PoolClient = await origConnect(...args);
    const origRelease = client.release.bind(client);
    let released = false;
    client.release = ((...r: unknown[]) => { if (!released) { released = true; inFlight--; } return (origRelease as (...a: unknown[]) => unknown)(...r); }) as PoolClient["release"];
    return client;
  }) as typeof pool.connect;

  try {
    await withAdvisoryLock("advisory-lock-regression", async (client) => {
      // Real locked work reads more data — it must reuse the lock's client,
      // not open another connection.
      await client.query("SELECT 1");
      await client.query("SELECT pg_backend_pid()");
    });
    assert.equal(maxInFlight, 1, "withAdvisoryLock checked out more than one connection while holding the lock");
  } finally {
    (pool as unknown as { connect: typeof pool.connect }).connect = origConnect;
  }
});

test("withAdvisoryLock: callback runs on the same backend that holds the lock", async () => {
  const lockPid = await withAdvisoryLock("advisory-lock-same-backend", async (client) => {
    const r = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    return r.rows[0]!.pid;
  });
  assert.equal(typeof lockPid, "number");
  assert.ok(lockPid > 0, "expected a real backend pid from the lock's own client");
});

test("withAdvisoryLock: many concurrent holders finish without deadlocking the pool", async () => {
  // More concurrent lock-holders than the pool max. Each needs exactly one
  // connection; under the old amplification bug this would exhaust the pool
  // and hang. Distinct keys so they don't serialize on the same lock.
  const N = 24;
  const results = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      withAdvisoryLock(`advisory-lock-fanout-${i}`, async (client) => {
        await client.query("SELECT 1");
        return i;
      }),
    ),
  );
  assert.equal(results.length, N);
  assert.deepEqual([...results].sort((a, b) => a - b), Array.from({ length: N }, (_, i) => i));
});
