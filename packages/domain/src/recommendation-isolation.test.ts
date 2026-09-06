import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createTask } from "./task-use-cases";
import { createAssumption } from "./assumption-use-cases";
import { createBusinessMetric } from "./business-metric-use-cases";
import { upsertForceAssessment } from "./force-assessment-use-cases";
import { getRecommendations } from "./recommendation-use-cases";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("recommendation ranking (Phase 7 sixth slice)", () => {
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
      "force_assessments",
      "experiments",
      "assumptions",
      "business_metrics",
      "tasks",
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

  it("rejects a non-member", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");
    const bob = await registerWithWorkspace("bob@example.com", "Bob Co");
    await expect(
      getRecommendations(db, { actorUserId: bob.user.id, workspaceId: alice.workspace.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("returns no recommendations for a fresh workspace", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const result = await getRecommendations(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
    });
    expect(result.recommendations).toEqual([]);
  });

  it("fires every rule and ranks high-priority recommendations first", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const workspaceId = alice.workspace.id;
    const actorUserId = alice.user.id;

    // Rule: primary constraint (high priority).
    await upsertForceAssessment(db, {
      workspaceId,
      actorUserId,
      force: "sales_marketing",
      score: 25,
      confidence: "high",
      evidence: "",
      constraintNote: "No repeatable lead source",
      recommendations: "",
    });

    // Rule: overdue tasks (2 -> medium, since below the 3-task high threshold).
    await createTask(db, {
      workspaceId,
      actorUserId,
      title: "Overdue task 1",
      description: "",
      priority: "medium",
      dueDate: new Date("2020-01-01"),
    });
    await createTask(db, {
      workspaceId,
      actorUserId,
      title: "Overdue task 2",
      description: "",
      priority: "medium",
      dueDate: new Date("2020-01-01"),
    });

    // Rule: untested assumptions.
    await createAssumption(db, {
      workspaceId,
      actorUserId,
      statement: "Customers will pay $50/mo",
      description: "",
      source: "",
      sourceType: "estimate-user",
      confidence: "medium",
      unit: "usd",
      value: 50,
    });

    // Rule: lagging metric (30% of the way to target, below the 50% threshold).
    const metric = await createBusinessMetric(db, {
      workspaceId,
      actorUserId,
      name: "Monthly recurring revenue",
      unit: "usd",
      direction: "increase",
      cadence: "monthly",
      baselineValue: 1000,
      targetValue: 2000,
      currentValue: 1300,
    });

    const result = await getRecommendations(db, { actorUserId, workspaceId });

    expect(result.recommendations).toHaveLength(4);
    const sources = result.recommendations.map((r) => r.source);
    expect(sources).toContain("constraint_diagnosis");
    expect(sources).toContain("overdue_tasks");
    expect(sources).toContain("untested_assumptions");
    expect(sources).toContain("lagging_metric");

    // High-priority recommendations come first.
    expect(result.recommendations[0]?.priority).toBe("high");
    expect(result.recommendations[0]?.source).toBe("constraint_diagnosis");
    expect(result.recommendations[0]?.relatedId).toBe("sales_marketing");

    const overdueRec = result.recommendations.find((r) => r.source === "overdue_tasks");
    expect(overdueRec?.priority).toBe("medium"); // only 2 overdue, below the high-priority threshold of 3

    const laggingMetricRec = result.recommendations.find((r) => r.source === "lagging_metric");
    expect(laggingMetricRec?.relatedId).toBe(metric.id);

    // Every recommendation with "high" priority must sort before every
    // "medium"/"low" one.
    const weights: Record<string, number> = { high: 3, medium: 2, low: 1 };
    for (let i = 1; i < result.recommendations.length; i++) {
      const prevWeight = weights[result.recommendations[i - 1]?.priority ?? "low"] ?? 0;
      const currWeight = weights[result.recommendations[i]?.priority ?? "low"] ?? 0;
      expect(prevWeight).toBeGreaterThanOrEqual(currWeight);
    }
  });

  it("does not recommend a metric already close to its target", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const workspaceId = alice.workspace.id;
    const actorUserId = alice.user.id;

    await createBusinessMetric(db, {
      workspaceId,
      actorUserId,
      name: "Monthly recurring revenue",
      unit: "usd",
      direction: "increase",
      cadence: "monthly",
      baselineValue: 1000,
      targetValue: 2000,
      currentValue: 1900, // 90% of the way there - not "lagging"
    });

    const result = await getRecommendations(db, { actorUserId, workspaceId });
    expect(result.recommendations.find((r) => r.source === "lagging_metric")).toBeUndefined();
  });
});
