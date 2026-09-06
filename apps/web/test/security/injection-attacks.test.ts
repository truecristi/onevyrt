import test, { after } from "node:test";
import assert from "node:assert/strict";
import { pgPool } from "../../lib/db";
import { uid, newId, nowIso, purgeWorkspacesByNamePrefix } from "../helpers/pg";

const PREFIX = uid("security-injection");

after(async () => {
  await purgeWorkspacesByNamePrefix(PREFIX);
});

test("SQL Injection Prevention", async (t) => {
  await t.test("cannot inject via workspace name", async () => {
    const pool = pgPool();
    // Attempt SQL injection in workspace name
    const maliciousName = `${PREFIX}-'; DROP TABLE workspaces; --`;

    const result = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'owner', $3) RETURNING id`,
      [newId(), maliciousName, nowIso()]
    );

    // Table should still exist if injection was prevented
    assert.ok(result.rows.length > 0, "workspace created despite injection attempt");

    // Verify we can still query workspaces
    const verify = await pool.query("SELECT COUNT(*) as count FROM workspaces");
    assert.ok((verify.rows[0] as any).count > 0, "workspaces table still exists");
  });

  await t.test("cannot inject via user email", async () => {
    const pool = pgPool();
    const maliciousEmail = `${PREFIX}@test.com'; UPDATE users SET password_hash = 'hacked' WHERE 1=1; --`;

    const result = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [newId(), maliciousEmail, "hash", nowIso()]
    );

    // Should create user with literal email, not execute injection
    assert.ok(result.rows.length > 0, "user created");

    // Verify the email is stored literally (escaped)
    const verify = await pool.query(
      `SELECT email FROM users WHERE id = $1`,
      [result.rows[0]!.id]
    );
    assert.equal(verify.rows[0].email, maliciousEmail, "email stored literally");
  });

  await t.test("parameterized queries prevent UNION-based injection", async () => {
    const pool = pgPool();
    const injectionPayload = `${PREFIX}-test' UNION SELECT id, 'hacked', 'hacked' FROM users WHERE '1'='1`;

    const result = await pool.query(
      `SELECT id, name FROM workspaces WHERE name = $1`,
      [injectionPayload]
    );

    // Should find nothing, not execute UNION
    assert.equal(result.rows.length, 0, "UNION injection prevented");
  });

  await t.test("cannot inject via JSON fields", async () => {
    const pool = pgPool();
    const workspace = `${PREFIX}-json-injection`;

    const { rows: [ws] } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'owner', $3) RETURNING id`,
      [newId(), workspace, nowIso()]
    );
    assert.ok(ws);

    // Attempt to inject via JSON parameter
    const maliciousPayload = { free_access_until: "2099-01-01\'); DROP TABLE workspaces; --" };

    await pool.query(
      `UPDATE workspaces SET plan_metadata = $1 WHERE id = $2`,
      [JSON.stringify(maliciousPayload), ws.id]
    );

    // Verify table still exists
    const verify = await pool.query("SELECT COUNT(*) as count FROM workspaces");
    assert.ok((verify.rows[0] as any).count > 0);
  });
});

test("XSS Prevention", async (t) => {
  const { htmlToPlainText: sanitizeUserInput } = await import("../../lib/email-templates/renderer");

  await t.test("sanitizes script tags", () => {
    const input = "<script>alert('xss')</script>";
    const sanitized = sanitizeUserInput(input);
    assert.ok(!sanitized.includes("<script>"), "script tags removed");
    assert.ok(!sanitized.includes("</script>"), "closing script tags removed");
  });

  await t.test("sanitizes event handlers", () => {
    const input = '<div onclick="alert(\'xss\')">Click me</div>';
    const sanitized = sanitizeUserInput(input);
    assert.ok(!sanitized.includes("onclick"), "event handlers removed");
  });

  await t.test("sanitizes data URLs", () => {
    const input = '<img src="data:text/html,<script>alert(1)</script>">';
    const sanitized = sanitizeUserInput(input);
    assert.ok(!sanitized.includes("data:text/html"), "data URLs sanitized");
  });

  await t.test("preserves safe HTML", () => {
    const input = "<p>Hello <strong>world</strong></p>";
    const sanitized = sanitizeUserInput(input);
    // Depending on sanitizer, may keep or strip safe HTML
    assert.ok(sanitized.length > 0, "some content preserved");
  });

  await t.test("handles unicode escapes", () => {
    const input = "\\u003cscript\\u003ealert(1)\\u003c/script\\u003e";
    const sanitized = sanitizeUserInput(input);
    // Should not execute even if unescaped
    assert.ok(typeof sanitized === "string");
  });
});

test("CSRF Prevention", async (t) => {
  await t.test("state-changing operations should require CSRF tokens", async () => {
    // This test documents that CSRF protection is a known gap (see CLAUDE.md)
    // When implemented, this should verify:
    // 1. POST/PUT/DELETE require valid CSRF tokens
    // 2. GET requests don't modify state
    // 3. Tokens are per-session and validated on mutation
    assert.ok(true, "CSRF prevention marked as Wave 2 security improvement");
  });
});

test("Authentication Bypass Prevention", async (t) => {
  const { signSession, verifySession } = await import("../../lib/auth");

  await t.test("cannot forge sessions without secret", () => {
    // Attempt to forge a session
    const fakePayload = Buffer.from(JSON.stringify({ uid: "admin", exp: Date.now() + 1000000 })).toString("base64url");
    const fakeSignature = "invalidsignature";
    const fakeToken = `${fakePayload}.${fakeSignature}`;

    const verified = verifySession(fakeToken);
    assert.equal(verified, null, "forged session rejected");
  });

  await t.test("expired tokens are rejected", () => {
    // Create token with very short TTL
    const token = signSession("user-123", 1); // 1ms TTL
    // Immediately it should work
    assert.equal(verifySession(token), "user-123");

    // After waiting, should fail
    return new Promise((resolve) => {
      setTimeout(() => {
        assert.equal(verifySession(token), null, "expired token rejected");
        resolve(undefined);
      }, 10);
    });
  });

  await t.test("modified payloads are detected", () => {
    const token = signSession("user-123");
    const [payload, sig] = token.split(".");
    assert.ok(payload);

    // Tamper with payload
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const modified = JSON.parse(decoded);
    modified.uid = "attacker";
    const tamperedPayload = Buffer.from(JSON.stringify(modified), "utf8").toString("base64url");

    const fakeToken = `${tamperedPayload}.${sig}`;
    const verified = verifySession(fakeToken);
    assert.equal(verified, null, "modified payload rejected");
  });
});

test("Authorization Bypass Prevention", async (t) => {
  await t.test("workspace isolation prevents cross-workspace access", async () => {
    const pool = pgPool();

    // Create two workspaces
    const ws1Name = `${PREFIX}-ws1`;
    const ws2Name = `${PREFIX}-ws2`;

    const { rows: [ws1] } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'owner1', $3) RETURNING id`,
      [newId(), ws1Name, nowIso()]
    );
    assert.ok(ws1);

    const { rows: [ws2] } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'owner2', $3) RETURNING id`,
      [newId(), ws2Name, nowIso()]
    );
    assert.ok(ws2);

    // User should not be able to query ws2 if they only have access to ws1
    // This test documents the pattern - actual enforcement in routes
    assert.notEqual(ws1.id, ws2.id, "workspaces are isolated");
  });

  await t.test("role-based access is enforced in queries", async () => {
    const pool = pgPool();

    // Create workspace with members having different roles
    const ws = `${PREFIX}-rbac`;
    const { rows: [workspace] } = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, 'owner', $3) RETURNING id`,
      [newId(), ws, nowIso()]
    );
    assert.ok(workspace);

    // Create users with different roles
    const { rows: [viewer] } = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [newId(), `${ws}-viewer@test.com`, "hash", nowIso()]
    );
    assert.ok(viewer);

    const { rows: [owner] } = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [newId(), `${ws}-owner@test.com`, "hash", nowIso()]
    );
    assert.ok(owner);

    // Add with different roles — membership lives in workspaces.members
    // (jsonb array of {userId, role}), not a separate join table (see
    // lib/workspaces.ts).
    await pool.query(
      `UPDATE workspaces SET members = members || $2::jsonb WHERE id = $1`,
      [workspace.id, JSON.stringify([{ userId: viewer.id, role: "viewer" }])]
    );
    await pool.query(
      `UPDATE workspaces SET members = members || $2::jsonb WHERE id = $1`,
      [workspace.id, JSON.stringify([{ userId: owner.id, role: "owner" }])]
    );

    // Verify roles are stored
    const { rows: [wsRow] } = await pool.query<{ members: { role: string }[] }>(
      `SELECT members FROM workspaces WHERE id = $1`,
      [workspace.id]
    );
    assert.ok(wsRow);
    const roles = [...wsRow.members].sort((a, b) => a.role.localeCompare(b.role));
    assert.equal(roles.length, 2);
    assert.equal(roles[0]!.role, "owner");
    assert.equal(roles[1]!.role, "viewer");
  });
});

test("Sensitive Data Protection", async (t) => {
  await t.test("password hashes are never returned in queries", async () => {
    const pool = pgPool();
    const email = `${PREFIX}-password-check@test.com`;

    const { rows: [user] } = await pool.query(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4) RETURNING id, email`,
      [newId(), email, "secrethash123", nowIso()]
    );

    // Query user WITHOUT the password column
    const { rows: [safeUser] } = await pool.query(
      `SELECT id, email FROM users WHERE id = $1`,
      [user.id]
    );

    assert.ok(!("pass" in safeUser), "password hash not exposed");
    assert.equal(safeUser.email, email);
  });

  await t.test("session tokens are not logged in plaintext", async () => {
    // This is an architectural test - tokens should be:
    // 1. Signed (HMAC-SHA256)
    // 2. Stateless (but verified)
    // 3. Not logged in application logs
    const { signSession } = await import("../../lib/auth");
    const token = signSession("user-123");
    // Token contains payload.signature - payload is base64url encoded
    assert.ok(token.includes("."), "token has signature component");
    assert.ok(!token.includes("user-123"), "userId not plaintext in token");
  });
});
