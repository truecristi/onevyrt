import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createTask } from "./task-use-cases";
import { listAuditLog } from "./audit-log-use-cases";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("audit log (Phase 2 tenth slice)", () => {
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
      "evidence",
      "decisions",
      "assumptions",
      "business_metrics",
      "tasks",
      "offers",
      "customer_profiles",
      "goals",
      "business_profiles",
      "audit_log",
      "sessions",
      "workspace_members",
      "workspaces",
      "users",
    ]);
  });

  async function registerWithWorkspace(email: string, workspaceName: string) {
    return registerUser(db, AUTH_SECRET, {
      email,
      password: "correct-horse-battery-staple",
      workspaceName,
    });
  }

  it("lists entries newest first, already populated by registration and other writes", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const task = await createTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Write the plan",
      description: "",
    });

    const entries = await listAuditLog(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      limit: 50,
    });

    // Registration writes at least one entry (workspace/membership created);
    // creating the task writes "task.created" on top of that.
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0]?.action).toBe("task.created");
    expect(entries[0]?.metadata).toMatchObject({ title: task.title });
    expect(entries.every((e) => e.workspaceId === alice.workspace.id)).toBe(true);
  });

  it("respects the limit parameter", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    for (let i = 0; i < 5; i++) {
      await createTask(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        title: `Task ${i}`,
        description: "",
      });
    }

    const entries = await listAuditLog(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      limit: 3,
    });
    expect(entries).toHaveLength(3);
  });

  it("prevents a user in one workspace from reading another workspace's audit log", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const bob = await registerWithWorkspace("bob3@example.com", "Bob Co 3");

    await expect(
      listAuditLog(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id, limit: 50 }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
