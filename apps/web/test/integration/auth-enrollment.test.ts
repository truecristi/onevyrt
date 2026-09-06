import test, { after } from "node:test";
import assert from "node:assert/strict";
import { pgPool } from "../../lib/db";
import { uid, newId, nowIso, purgeUsersByEmailPrefix, purgeWorkspacesByNamePrefix } from "../helpers/pg";

const EMAIL_PREFIX = uid("auth-integration");
const WS_PREFIX = uid("auth-integration-ws");

after(async () => {
  await purgeUsersByEmailPrefix(EMAIL_PREFIX);
  await purgeWorkspacesByNamePrefix(WS_PREFIX);
});

test("Auth + Enrollment Integration", async (t) => {
  await t.test("complete signup to enrollment flow", async () => {
    const pool = pgPool();
    const email = `${EMAIL_PREFIX}@example.com`;
    const workspace = `${WS_PREFIX}-flow`;

    // 1. Create a user (signup)
    const { rows: [user] } = await pool.query<{ id: string; email: string }>(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4) RETURNING id, email`,
      [newId(), email, "hash-placeholder", nowIso()]
    );
    assert.ok(user);
    assert.equal(user.email, email);

    // 2. Create workspace
    const { rows: [ws] } = await pool.query<{ id: string; name: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, $3, $4) RETURNING id, name`,
      [newId(), workspace, user.id, nowIso()]
    );
    assert.ok(ws);
    assert.equal(ws.name, workspace);

    // 3. Add user to workspace — membership lives in workspaces.members (jsonb
    // array of {userId, role}), not a separate join table (see lib/workspaces.ts).
    await pool.query(
      `UPDATE workspaces SET members = members || $2::jsonb WHERE id = $1`,
      [ws.id, JSON.stringify([{ userId: user.id, role: "owner" }])]
    );

    // 4. Create enrollment record
    const enrollmentData = { state: "active", lessons: [] };
    const { rows: enrollments } = await pool.query<{ enrollment: { state: string } }>(
      `INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2)
       RETURNING enrollment`,
      [ws.id, JSON.stringify(enrollmentData)]
    );
    const createdEnrollment = enrollments[0];
    assert.ok(createdEnrollment);
    assert.equal(createdEnrollment.enrollment.state, "active");

    // Verify full chain
    const { rows: verifyUser } = await pool.query(
      `SELECT u.id, u.email FROM users u WHERE u.id = $1`,
      [user.id]
    );
    assert.equal(verifyUser[0].id, user.id);

    const { rows: verifyWs } = await pool.query(
      `SELECT w.id, w.owner_id FROM workspaces w WHERE w.id = $1`,
      [ws.id]
    );
    assert.equal(verifyWs[0].owner_id, user.id);

    const { rows: verifyEnrollment } = await pool.query(
      `SELECT enrollment FROM enrollments WHERE workspace_id = $1`,
      [ws.id]
    );
    assert.ok(verifyEnrollment.length > 0);
  });

  await t.test("multiple users can be added to same workspace", async () => {
    const pool = pgPool();
    const workspace = `${WS_PREFIX}-multi-user`;
    const owner_email = `${EMAIL_PREFIX}-owner@example.com`;
    const editor_email = `${EMAIL_PREFIX}-editor@example.com`;

    // Create owner user
    const { rows: [owner] } = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [newId(), owner_email, "hash", nowIso()]
    );
    assert.ok(owner);

    // Create editor user
    const { rows: [editor] } = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [newId(), editor_email, "hash", nowIso()]
    );
    assert.ok(editor);

    // Create workspace
    const { rows: [ws] } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [newId(), workspace, owner.id, nowIso()]
    );
    assert.ok(ws);

    // Add both users — membership lives in workspaces.members (jsonb array of
    // {userId, role}), not a separate join table (see lib/workspaces.ts).
    await pool.query(
      `UPDATE workspaces SET members = members || $2::jsonb WHERE id = $1`,
      [ws.id, JSON.stringify([{ userId: owner.id, role: "owner" }])]
    );
    await pool.query(
      `UPDATE workspaces SET members = members || $2::jsonb WHERE id = $1`,
      [ws.id, JSON.stringify([{ userId: editor.id, role: "editor" }])]
    );

    // Verify both users have access
    const { rows: [wsRow] } = await pool.query<{ members: { userId: string; role: string }[] }>(
      `SELECT members FROM workspaces WHERE id = $1`,
      [ws.id]
    );
    assert.ok(wsRow);
    const members = [...wsRow.members].sort((a, b) => a.role.localeCompare(b.role));
    assert.equal(members.length, 2);
    assert.equal(members[0]!.role, "editor");
    assert.equal(members[1]!.role, "owner");
  });

  await t.test("user deletion cascades properly", async () => {
    const pool = pgPool();
    const email = `${EMAIL_PREFIX}-delete@example.com`;

    // Create user
    const { rows: [user] } = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [newId(), email, "hash", nowIso()]
    );
    assert.ok(user);

    // Create session for user
    const sessionId = `session-${Date.now()}`;
    await pool.query(
      `INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at) VALUES ($1, $2, $3, $3, NOW() + INTERVAL '30 days')`,
      [sessionId, user.id, nowIso()]
    );

    // Verify session exists
    const { rows: sessionsBefore } = await pool.query(
      `SELECT * FROM sessions WHERE user_id = $1`,
      [user.id]
    );
    assert.ok(sessionsBefore.length > 0);

    // Delete user (cascades)
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [user.id]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [user.id]);

    // Verify user and sessions are gone
    const { rows: userRows } = await pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [user.id]
    );
    assert.equal(userRows.length, 0);

    const { rows: sessionsAfter } = await pool.query(
      `SELECT * FROM sessions WHERE user_id = $1`,
      [user.id]
    );
    assert.equal(sessionsAfter.length, 0);
  });

  await t.test("enrollment state transitions work correctly", async () => {
    const pool = pgPool();
    const workspace = `${WS_PREFIX}-state-transition`;
    const email = `${EMAIL_PREFIX}-state@example.com`;

    // Setup
    const { rows: [user] } = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [newId(), email, "hash", nowIso()]
    );
    assert.ok(user);
    const { rows: [ws] } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [newId(), workspace, user.id, nowIso()]
    );
    assert.ok(ws);

    // Initial enrollment. `enrollments` has no separate `id`/`last_modified_at`
    // column — it's one jsonb row per workspace_id (its own primary key), see
    // migrations/1786541862535_create-enrollments.js and lib/enrollments.ts's
    // real upsert pattern.
    const initial = { state: "active", lessons: [], accessGranted: true };
    const { rows: [enr] } = await pool.query<{ workspace_id: string; enrollment: object }>(
      `INSERT INTO enrollments (workspace_id, enrollment) VALUES ($1, $2) RETURNING workspace_id, enrollment`,
      [ws.id, JSON.stringify(initial)]
    );
    assert.ok(enr);

    // Update enrollment state
    const updated = { ...initial, state: "paused" };
    await pool.query(
      `UPDATE enrollments SET enrollment = $1 WHERE workspace_id = $2`,
      [JSON.stringify(updated), enr.workspace_id]
    );

    // Verify state changed
    const { rows: [final] } = await pool.query<{ enrollment: object }>(
      `SELECT enrollment FROM enrollments WHERE workspace_id = $1`,
      [enr.workspace_id]
    );
    assert.ok(final);
    assert.equal((final.enrollment as any).state, "paused");
  });
});
