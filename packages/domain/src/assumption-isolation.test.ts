import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createAssumption, listAssumptions, updateAssumption } from "./assumption-use-cases";
import { AssumptionNotFoundError } from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("assumptions (Phase 2 seventh slice)", () => {
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

  it("creates and lists assumptions newest first, defaulting to medium confidence and unvalidated status", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const first = await createAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      statement: "Trial-to-paid conversion is 2%",
      description: "",
      source: "industry benchmark",
      confidence: "medium",
      unit: "%",
      value: 2,
    });
    expect(first.confidence).toBe("medium");
    expect(first.status).toBe("unvalidated");
    expect(first.value).toBe(2);

    const second = await createAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      statement: "Average order value grows 5% per quarter",
      description: "",
      source: "",
      confidence: "low",
      unit: "%",
    });
    expect(second.value).toBeNull();

    const assumptions = await listAssumptions(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(assumptions.map((a) => a.id)).toEqual([second.id, first.id]);
  });

  it("moves status from unvalidated to validated independently of the value", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const assumption = await createAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      statement: "Churn is under 3% monthly",
      description: "",
      source: "",
      confidence: "low",
      unit: "%",
      value: 3,
    });

    const validated = await updateAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      assumptionId: assumption.id,
      status: "validated",
      confidence: "high",
    });

    expect(validated.status).toBe("validated");
    expect(validated.confidence).toBe("high");
    expect(validated.value).toBe(3);
  });

  it("can explicitly clear a value back to null", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const assumption = await createAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      statement: "Something with a number",
      description: "",
      source: "",
      confidence: "medium",
      unit: "",
      value: 10,
    });

    const cleared = await updateAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      assumptionId: assumption.id,
      value: null,
    });

    expect(cleared.value).toBeNull();
    expect(cleared.statement).toBe("Something with a number");
  });

  it("throws AssumptionNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    await expect(
      updateAssumption(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        assumptionId: "00000000-0000-0000-0000-000000000000",
        status: "validated",
      }),
    ).rejects.toThrow(AssumptionNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's assumptions", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    const bob = await registerWithWorkspace("bob5@example.com", "Bob Co 5");

    const alicesAssumption = await createAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      statement: "Alice's assumption",
      description: "",
      source: "",
      confidence: "medium",
      unit: "",
    });

    await expect(
      listAssumptions(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createAssumption(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        statement: "Should fail",
        description: "",
        source: "",
        confidence: "medium",
        unit: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      updateAssumption(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        assumptionId: alicesAssumption.id,
        status: "validated",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
