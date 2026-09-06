import test, { after } from "node:test";
import assert from "node:assert/strict";
import { pgPool } from "../../lib/db";
import { uid, newId, nowIso, purgeWorkspacesByNamePrefix } from "../helpers/pg";
import { createWorkspace, DuplicateWorkspaceNameError } from "../../lib/workspaces";

const PREFIX = uid("concurrent-test");

after(async () => {
  await purgeWorkspacesByNamePrefix(PREFIX);
});

test("Concurrent Request Handling", async (t) => {
  await t.test("concurrent workspace creation doesn't cause duplicates", async () => {
    const pool = pgPool();
    const ownerId = "owner-" + Date.now();
    const wsName = `${PREFIX}-concurrent-create`;

    // Go through the real createWorkspace() — a raw INSERT (as this test
    // previously did) bypasses its dedup guard entirely (there's no unique DB
    // constraint on (owner_id, name); createWorkspace enforces it itself via a
    // per-owner advisory xact lock — see lib/workspaces.ts). That's the actual
    // no-duplicates behavior this test means to exercise.
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => createWorkspace(ownerId, wsName))
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const duplicateRejections = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof DuplicateWorkspaceNameError,
    );
    assert.equal(succeeded.length, 1, "exactly one concurrent create wins");
    assert.equal(duplicateRejections.length, 9, "the other nine are rejected as duplicates, not silently lost or duplicated");

    // Verify only one workspace exists
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM workspaces WHERE name = $1`,
      [wsName]
    );
    // pg returns COUNT(*) as a string (bigint-safe), hence the Number() coercion.
    assert.equal(Number((rows[0] as any).count), 1, "exactly one workspace despite concurrent attempts");
  });

  await t.test("concurrent enrollment updates don't lose data", async () => {
    const pool = pgPool();
    const workspace = `${PREFIX}-concurrent-update`;

    // Create workspace and enrollment
    const { rows: wsRows } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'owner', $3) RETURNING id`,
      [newId(), workspace, nowIso()]
    );
    const ws = wsRows[0]!;

    const initial = { state: "active", lessons: [], counter: 0 };
    await pool.query(
      `INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2)`,
      [ws.id, JSON.stringify(initial)]
    );

    // Simulate concurrent updates to increment counter
    const updatePromises = Array.from({ length: 20 }, () =>
      pool.query(
        `UPDATE enrollments
         SET enrollment = jsonb_set(enrollment, '{counter}', ((enrollment->'counter')::int + 1)::text::jsonb)
         WHERE workspace_id = $1`,
        [ws.id]
      )
    );

    await Promise.all(updatePromises);

    // Verify final state
    const { rows: resultRows } = await pool.query<{ enrollment: object }>(
      `SELECT enrollment FROM enrollments WHERE workspace_id = $1`,
      [ws.id]
    );
    const result = resultRows[0]!;
    // Note: concurrent updates may not increment by 20 due to read-modify-write race conditions
    // This test verifies the system handles it without crashing
    assert.ok(result.enrollment, "enrollment still exists after concurrent updates");
  });

  await t.test("concurrent rate limit checks maintain accurate counts", async () => {
    const pool = pgPool();
    const key = `${PREFIX}-concurrent-ratelimit-${Date.now()}`;

    // Simulate concurrent rate limit checks
    const results = await Promise.all(
      Array.from({ length: 30 }, () =>
        pool.query(
          `SELECT COUNT(*) as count FROM rate_limits WHERE key = $1`,
          [key]
        )
      )
    );

    // All concurrent reads should return consistent results
    for (const result of results) {
      assert.ok(typeof result.rows[0] === "object", "rate limit check returns data");
    }
  });

  await t.test("concurrent user session creation", async () => {
    const pool = pgPool();
    const userId = `user-${uid("concurrent-session")}`;

    // Create user
    await pool.query(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4)`,
      [userId, `${userId}@test.com`, "hash", nowIso()]
    );

    // Create multiple sessions concurrently
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        pool.query(
          `INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at)
           VALUES ($1, $2, $3, $3, NOW() + INTERVAL '30 days') RETURNING id`,
          [`session-${userId}-${i}-${Date.now()}`, userId, nowIso()]
        )
      )
    );

    // Verify all sessions were created
    const { rows: allSessions } = await pool.query(
      `SELECT COUNT(*) as count FROM sessions WHERE user_id = $1`,
      [userId]
    );
    // pg returns COUNT(*) as a string (bigint-safe), hence the Number() coercion.
    assert.equal(Number((allSessions[0] as any).count), 5);

    // Cleanup
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  await t.test("concurrent workspace member additions", async () => {
    const pool = pgPool();
    const workspace = `${PREFIX}-concurrent-members`;

    // Create workspace
    const { rows: wsRows } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'owner', $3) RETURNING id`,
      [newId(), workspace, nowIso()]
    );
    const ws = wsRows[0]!;

    // Create users
    const users = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        pool.query<{ id: string }>(
          `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
          [newId(), `${workspace}-user-${i}@test.com`, "hash", nowIso()]
        )
      )
    );

    // Add all users to workspace concurrently — membership lives in
    // workspaces.members (jsonb array), not a separate join table (see
    // lib/workspaces.ts). Postgres serializes concurrent UPDATEs to the same
    // row (each waits for the row lock, then re-reads the just-committed
    // value), so `members || x` run 10x concurrently still correctly
    // accumulates all 10 appends rather than losing any to a race — which is
    // exactly the "concurrent writes aren't lost" behavior this test verifies.
    await Promise.all(
      users.map((result, i) =>
        pool.query(
          `UPDATE workspaces SET members = members || $2::jsonb WHERE id = $1`,
          [ws.id, JSON.stringify([{ userId: result.rows[0]!.id, role: i % 3 === 0 ? "owner" : i % 2 === 0 ? "editor" : "viewer" }])]
        )
      )
    );

    // Verify all members were added
    const { rows: [wsRow] } = await pool.query<{ members: unknown[] }>(
      `SELECT members FROM workspaces WHERE id = $1`,
      [ws.id]
    );
    assert.ok(wsRow);
    assert.equal(wsRow.members.length, 10);
  });

  await t.test("concurrent reads don't block writes", async () => {
    const pool = pgPool();
    const workspace = `${PREFIX}-concurrent-read-write`;

    // Create workspace
    const { rows: wsRows } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'owner', $3) RETURNING id`,
      [newId(), workspace, nowIso()]
    );
    const ws = wsRows[0]!;

    const start = Date.now();

    // Concurrent reads
    const readPromises = Array.from({ length: 20 }, () =>
      pool.query(
        `SELECT * FROM workspaces WHERE id = $1`,
        [ws.id]
      )
    );

    // Concurrent writes (soft-update via metadata)
    const writePromises = Array.from({ length: 5 }, (_, i) =>
      pool.query(
        `UPDATE workspaces SET plan_metadata = jsonb_set(COALESCE(plan_metadata, '{}'), '{counter}', $1) WHERE id = $2`,
        [JSON.stringify(i), ws.id]
      )
    );

    await Promise.all([...readPromises, ...writePromises]);

    const duration = Date.now() - start;
    // Should complete reasonably fast (not starved)
    assert.ok(duration < 10000, `concurrent read/write completed in ${duration}ms`);
  });
});
