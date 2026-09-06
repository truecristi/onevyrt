import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import {
  createBusinessMetric,
  listBusinessMetrics,
  updateBusinessMetric,
} from "./business-metric-use-cases";
import { BusinessMetricNotFoundError } from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("business metrics (Phase 2 sixth slice)", () => {
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

  it("creates and lists metrics newest first, with defaults for direction/cadence", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const first = await createBusinessMetric(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Monthly recurring revenue",
      unit: "$",
      direction: "increase",
      cadence: "monthly",
      targetValue: 10000,
    });
    expect(first.direction).toBe("increase");
    expect(first.cadence).toBe("monthly");
    expect(first.baselineValue).toBeNull();
    expect(first.currentValue).toBeNull();
    expect(first.targetValue).toBe(10000);

    const second = await createBusinessMetric(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Churn rate",
      unit: "%",
      direction: "decrease",
      cadence: "monthly",
    });

    const metrics = await listBusinessMetrics(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(metrics.map((m) => m.id)).toEqual([second.id, first.id]);
  });

  it("updates fields and can explicitly clear a value back to null", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const metric = await createBusinessMetric(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Active customers",
      unit: "count",
      direction: "increase",
      cadence: "weekly",
      currentValue: 42,
    });

    const updated = await updateBusinessMetric(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      metricId: metric.id,
      currentValue: 55,
    });
    expect(updated.currentValue).toBe(55);

    const cleared = await updateBusinessMetric(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      metricId: metric.id,
      currentValue: null,
    });
    expect(cleared.currentValue).toBeNull();
    // Fields not mentioned in the patch stay unchanged.
    expect(cleared.name).toBe("Active customers");
    expect(cleared.unit).toBe("count");
  });

  it("throws BusinessMetricNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    await expect(
      updateBusinessMetric(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        metricId: "00000000-0000-0000-0000-000000000000",
        currentValue: 1,
      }),
    ).rejects.toThrow(BusinessMetricNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's metrics", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const bob = await registerWithWorkspace("bob4@example.com", "Bob Co 4");

    const alicesMetric = await createBusinessMetric(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Alice's metric",
      unit: "",
      direction: "increase",
      cadence: "monthly",
    });

    await expect(
      listBusinessMetrics(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createBusinessMetric(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        name: "Should fail",
        unit: "",
        direction: "increase",
        cadence: "monthly",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      updateBusinessMetric(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        metricId: alicesMetric.id,
        currentValue: 1,
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
