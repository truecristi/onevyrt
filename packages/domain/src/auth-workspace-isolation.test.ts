import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser, loginUser, verifySessionToken, revokeSession } from "./auth-use-cases";
import { getMembership, listWorkspacesForUser } from "./workspace-use-cases";
import { EmailAlreadyRegisteredError, InvalidCredentialsError } from "./errors";
import { canReadWorkspace } from "@onevyrt/auth";
import type { Pool } from "pg";

// Integration test against a real Postgres (§14.1) - this is the concrete
// evidence for §46 item 20: "verify that a second workspace cannot access
// any object from the first."
const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "f".repeat(64);

describe("auth + workspace isolation (Phase 1 vertical slice)", () => {
  let db: Database;
  let pool: Pool;
  let cleanupClient: Client;

  beforeAll(async () => {
    await runMigrations(TEST_DATABASE_URL);
    const created = createDatabase(TEST_DATABASE_URL);
    db = created.db;
    pool = created.pool;
    cleanupClient = new Client({ connectionString: TEST_DATABASE_URL });
    await cleanupClient.connect();
  });

  afterAll(async () => {
    await pool.end();
    await cleanupClient.end();
  });

  beforeEach(async () => {
    await truncateTables(cleanupClient, [
      "audit_log",
      "sessions",
      "workspace_members",
      "workspaces",
      "users",
    ]);
  });

  it("registers a user with their own workspace and a valid session", async () => {
    const result = await registerUser(db, AUTH_SECRET, {
      email: "alice@example.com",
      password: "correct-horse-battery-staple",
      workspaceName: "Alice's Business",
    });

    expect(result.user.email).toBe("alice@example.com");
    expect(result.workspace.name).toBe("Alice's Business");

    const authenticated = await verifySessionToken(db, AUTH_SECRET, result.sessionToken);
    expect(authenticated?.id).toBe(result.user.id);
  });

  it("rejects registering the same email twice", async () => {
    await registerUser(db, AUTH_SECRET, {
      email: "dup@example.com",
      password: "correct-horse-battery-staple",
      workspaceName: "First",
    });

    await expect(
      registerUser(db, AUTH_SECRET, {
        email: "dup@example.com",
        password: "another-password-123",
        workspaceName: "Second",
      }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });

  it("logs in with correct credentials and rejects incorrect ones", async () => {
    await registerUser(db, AUTH_SECRET, {
      email: "bob@example.com",
      password: "correct-horse-battery-staple",
      workspaceName: "Bob's Business",
    });

    const login = await loginUser(db, AUTH_SECRET, {
      email: "bob@example.com",
      password: "correct-horse-battery-staple",
    });
    expect(login.user.email).toBe("bob@example.com");

    await expect(
      loginUser(db, AUTH_SECRET, { email: "bob@example.com", password: "wrong-password" }),
    ).rejects.toThrow(InvalidCredentialsError);

    await expect(
      loginUser(db, AUTH_SECRET, { email: "nobody@example.com", password: "anything-at-all" }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("returns null for an invalid or garbage session token", async () => {
    expect(await verifySessionToken(db, AUTH_SECRET, "not-a-real-token")).toBeNull();
  });

  it("revokeSession invalidates the token immediately, not just the cookie", async () => {
    const result = await registerUser(db, AUTH_SECRET, {
      email: "logout@example.com",
      password: "correct-horse-battery-staple",
      workspaceName: "Logout Co",
    });

    expect(await verifySessionToken(db, AUTH_SECRET, result.sessionToken)).not.toBeNull();

    await revokeSession(db, AUTH_SECRET, result.sessionToken);

    expect(await verifySessionToken(db, AUTH_SECRET, result.sessionToken)).toBeNull();
  });

  it("revoking an already-revoked or nonexistent session is a no-op, not an error", async () => {
    await expect(revokeSession(db, AUTH_SECRET, "never-issued-token")).resolves.toBeUndefined();
  });

  it("resolves concurrent registrations for the same email to exactly one success, never an unhandled error", async () => {
    const attempts = Array.from({ length: 5 }, (_, i) =>
      registerUser(db, AUTH_SECRET, {
        email: "race@example.com",
        password: "correct-horse-battery-staple",
        workspaceName: `Race Co ${i}`,
      }),
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    // Every failure must be the clean, expected error - not a raw Postgres
    // unique-violation or any other unhandled error type.
    for (const failure of rejected) {
      expect(failure.reason).toBeInstanceOf(EmailAlreadyRegisteredError);
    }
  });

  it("prevents a user in one workspace from reading a second workspace they don't belong to", async () => {
    const alice = await registerUser(db, AUTH_SECRET, {
      email: "alice2@example.com",
      password: "correct-horse-battery-staple",
      workspaceName: "Alice Co",
    });
    const bob = await registerUser(db, AUTH_SECRET, {
      email: "bob2@example.com",
      password: "correct-horse-battery-staple",
      workspaceName: "Bob Co",
    });

    // Alice can read her own workspace.
    const aliceOwnMembership = await getMembership(db, alice.workspace.id, alice.user.id);
    expect(canReadWorkspace(aliceOwnMembership)).toBe(true);

    // Alice cannot read Bob's workspace - this is the isolation guarantee.
    const aliceOnBobsWorkspace = await getMembership(db, bob.workspace.id, alice.user.id);
    expect(canReadWorkspace(aliceOnBobsWorkspace)).toBe(false);
    expect(aliceOnBobsWorkspace).toBeNull();

    // And listWorkspacesForUser never surfaces the other user's workspace.
    const aliceWorkspaces = await listWorkspacesForUser(db, alice.user.id);
    expect(aliceWorkspaces).toEqual([{ id: alice.workspace.id, name: "Alice Co", role: "owner" }]);

    const bobWorkspaces = await listWorkspacesForUser(db, bob.user.id);
    expect(bobWorkspaces).toEqual([{ id: bob.workspace.id, name: "Bob Co", role: "owner" }]);
  });
});
