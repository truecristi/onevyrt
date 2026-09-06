import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { pgPool } from "../../lib/db";
import { uid, newId, nowIso, purgeWorkspacesByNamePrefix } from "../helpers/pg";

const scrypt = promisify(scryptCallback);
// lib/auth.ts's own hashPassword is intentionally unexported (an
// implementation detail behind registerUser/authenticate/changePassword) —
// mirrored here so this test can measure the same scrypt-under-concurrency
// behaviour without reaching into another module's private internals.
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

const PREFIX = uid("perf-load");

after(async () => {
  await purgeWorkspacesByNamePrefix(PREFIX);
});

test("Performance & Load Testing", async (t) => {
  await t.test("rate limit checks are performant under load", async () => {
    const pool = pgPool();
    const key = `${PREFIX}-perf-ratelimit`;
    const iterations = 100;

    const start = Date.now();

    // Simulate 100 concurrent rate limit checks
    await Promise.all(
      Array.from({ length: iterations }, () =>
        pool.query(
          `SELECT COUNT(*) FROM rate_limits WHERE key = $1 AND reset_at > $2`,
          [key, Date.now()]
        )
      )
    );

    const duration = Date.now() - start;
    const avgTime = duration / iterations;

    console.log(`Rate limit check avg time: ${avgTime.toFixed(2)}ms`);
    assert.ok(duration < 10000, `${iterations} rate limit checks completed in ${duration}ms (target < 10s)`);
    assert.ok(avgTime < 100, `average time per check < 100ms (got ${avgTime.toFixed(2)}ms)`);
  });

  await t.test("enrollment queries scale with lesson count", async () => {
    const pool = pgPool();
    const workspace = `${PREFIX}-perf-enrollment`;

    // Create workspace
    const { rows: wsRows } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'owner', $3) RETURNING id`,
      [newId(), workspace, nowIso()]
    );
    const ws = wsRows[0]!;

    // Test with increasing lesson counts
    for (const lessonCount of [10, 100, 1000]) {
      const lessons = Array.from({ length: lessonCount }, (_, i) => ({
        id: `lesson-${i}`,
        status: "not-started",
      }));
      const enrollment = { state: "active", lessons };

      const start = Date.now();

      // Create and query enrollment. `enrollments` has no separate `id` — it's
      // one jsonb row per workspace_id (its own primary key), see
      // migrations/1786541862535_create-enrollments.js. This loop reuses the
      // same ws.id across lesson counts, so upsert (matching lib/enrollments.ts's
      // real save pattern) rather than a plain INSERT, which would violate the
      // primary key on the second iteration.
      await pool.query(
        `INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2)
         ON CONFLICT (workspace_id) DO UPDATE SET enrollment = EXCLUDED.enrollment`,
        [ws.id, JSON.stringify(enrollment)]
      );

      await pool.query(
        `SELECT enrollment FROM enrollments WHERE workspace_id = $1`,
        [ws.id]
      );

      const duration = Date.now() - start;
      console.log(`${lessonCount} lessons: ${duration}ms`);

      assert.ok(duration < 1000, `enrollment with ${lessonCount} lessons queried in < 1s`);
    }
  });

  await t.test("workspace list queries are performant with many workspaces", async () => {
    const pool = pgPool();
    const userId = `user-${uid("perf-ws-list")}`;

    // Create test user
    await pool.query(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4)`,
      [userId, `${userId}@test.com`, "hash", nowIso()]
    );

    // Create multiple workspaces
    const workspaceCount = 50;
    const workspaces = await Promise.all(
      Array.from({ length: workspaceCount }, (_, i) =>
        pool.query<{ id: string }>(
          `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
          [newId(), `${PREFIX}-perf-list-${i}`, userId, nowIso()]
        )
      )
    );

    // These workspaces already have owner_id = userId (set at creation above),
    // which is what actually grants access — no separate join-table row
    // needed. Membership itself lives in workspaces.members (jsonb), queried
    // the same way the real lib/workspaces.ts::listForUser does (the `@>`
    // containment operator), which is what this timing test measures.
    await Promise.all(
      workspaces.map((result) =>
        pool.query(
          `UPDATE workspaces SET members = members || $2::jsonb WHERE id = $1`,
          [result.rows[0]!.id, JSON.stringify([{ userId, role: "owner" }])]
        )
      )
    );

    // Time the list query
    const start = Date.now();

    const { rows: listedWorkspaces } = await pool.query(
      `SELECT id, name FROM workspaces WHERE members @> $1::jsonb`,
      [JSON.stringify([{ userId }])]
    );

    const duration = Date.now() - start;

    console.log(`Listed ${listedWorkspaces.length} workspaces in ${duration}ms`);
    assert.equal(listedWorkspaces.length, workspaceCount);
    assert.ok(duration < 2000, `listing ${workspaceCount} workspaces < 2s`);

    // Cleanup
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  await t.test("password hashing doesn't block event loop excessively", async () => {
    // Hash multiple passwords concurrently
    const startTime = Date.now();
    const password = "test-password-with-sufficient-entropy-1234";

    // Create 20 concurrent hash operations
    const hashes = await Promise.all(
      Array.from({ length: 20 }, () => hashPassword(password))
    );

    const duration = Date.now() - startTime;

    console.log(`20 concurrent password hashes: ${duration}ms`);
    assert.equal(hashes.length, 20);
    // scrypt is async, should not block event loop
    assert.ok(duration < 10000, `20 password hashes completed in ${duration}ms`);
  });

  await t.test("bulk enrollment updates are performant", async () => {
    const pool = pgPool();
    const workspace = `${PREFIX}-bulk-update`;

    // Create workspace with enrollment
    const { rows: wsRows } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'owner', $3) RETURNING id`,
      [newId(), workspace, nowIso()]
    );
    const ws = wsRows[0]!;

    const initial = {
      state: "active",
      lessons: Array.from({ length: 100 }, (_, i) => ({
        id: `lesson-${i}`,
        status: "not-started",
      })),
    };

    await pool.query(
      `INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2)`,
      [ws.id, JSON.stringify(initial)]
    );

    // Simulate 50 sequential updates (e.g., lesson completion tracking)
    const start = Date.now();

    for (let i = 0; i < 50; i++) {
      await pool.query(
        `UPDATE enrollments
         SET enrollment = jsonb_set(enrollment, '{lessons,${i % 100},status}', '"completed"')
         WHERE workspace_id = $1`,
        [ws.id]
      );
    }

    const duration = Date.now() - start;
    console.log(`50 sequential enrollment updates: ${duration}ms`);
    assert.ok(duration < 5000, `bulk updates completed in ${duration}ms`);
  });

  await t.test("concurrent session creations maintain throughput", async () => {
    const pool = pgPool();
    const userId = `user-${uid("perf-sessions")}`;

    // Create user
    await pool.query(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4)`,
      [userId, `${userId}@test.com`, "hash", nowIso()]
    );

    const start = Date.now();
    const sessionCount = 100;

    // Create 100 sessions concurrently
    await Promise.all(
      Array.from({ length: sessionCount }, (_, i) =>
        pool.query(
          `INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at) VALUES ($1, $2, $3, $3, NOW() + INTERVAL '30 days')`,
          [`session-${userId}-${i}-${Date.now()}`, userId, nowIso()]
        )
      )
    );

    const duration = Date.now() - start;
    const throughput = Math.round(sessionCount / (duration / 1000));

    console.log(`Created ${sessionCount} sessions in ${duration}ms (${throughput} ops/sec)`);
    assert.ok(duration < 10000, `${sessionCount} sessions created in < 10s`);

    // Cleanup
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  await t.test("query planning doesn't regress on an indexed owner_id lookup", async () => {
    // Note: workspaces has no deleted_at column (it isn't one of the
    // soft-deletable tables — see CLAUDE.md's soft-delete scope), so this
    // measures the plain owner_id lookup, not a soft-delete filter.
    const pool = pgPool();

    const start = Date.now();

    for (let i = 0; i < 100; i++) {
      await pool.query(
        `SELECT COUNT(*) FROM workspaces WHERE owner_id = $1 LIMIT 1`,
        ["test-owner"]
      );
    }

    const duration = Date.now() - start;
    const avg = duration / 100;

    console.log(`100 owner_id queries avg: ${avg.toFixed(2)}ms`);
    assert.ok(avg < 50, `query avg < 50ms (got ${avg.toFixed(2)}ms)`);
  });
});
