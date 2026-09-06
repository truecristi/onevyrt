import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createGoal, updateGoalStatus } from "./business-core-use-cases";
import { createTask, updateTaskStatus } from "./task-use-cases";
import { createExperiment, updateExperiment } from "./experiment-use-cases";
import { createBusinessMetric } from "./business-metric-use-cases";
import { getWorkspaceScorecard } from "./scorecard-use-cases";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("scorecards (Phase 7 first slice)", () => {
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
      "experiments",
      "tasks",
      "goals",
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
      getWorkspaceScorecard(db, { actorUserId: bob.user.id, workspaceId: alice.workspace.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("returns an empty-but-valid scorecard for a fresh workspace", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const scorecard = await getWorkspaceScorecard(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
    });

    expect(scorecard.goals).toEqual({
      total: 0,
      active: 0,
      achieved: 0,
      abandoned: 0,
      achievementRate: 0,
    });
    expect(scorecard.tasks).toEqual({
      total: 0,
      open: 0,
      inProgress: 0,
      done: 0,
      completionRate: 0,
      overdueCount: 0,
    });
    expect(scorecard.experiments.total).toBe(0);
    expect(scorecard.experiments.decisionCounts).toEqual({
      adopt: 0,
      iterate: 0,
      retest: 0,
      stop: 0,
      insufficient_evidence: 0,
      reject: 0,
    });
    expect(scorecard.metrics).toEqual({ total: 0, measurable: 0, metrics: [] });
  });

  it("aggregates real records and derives correct summary counts and rates", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const workspaceId = alice.workspace.id;
    const actorUserId = alice.user.id;

    const achievedGoal = await createGoal(db, {
      workspaceId,
      actorUserId,
      title: "Reach $10k MRR",
      description: "",
    });
    await updateGoalStatus(db, {
      workspaceId,
      actorUserId,
      goalId: achievedGoal.id,
      status: "achieved",
    });
    await createGoal(db, { workspaceId, actorUserId, title: "Launch v2", description: "" }); // stays active

    const doneTask = await createTask(db, {
      workspaceId,
      actorUserId,
      title: "Ship onboarding flow",
      description: "",
      priority: "high",
    });
    await updateTaskStatus(db, { workspaceId, actorUserId, taskId: doneTask.id, status: "done" });
    await createTask(db, {
      workspaceId,
      actorUserId,
      title: "Overdue task",
      description: "",
      priority: "medium",
      dueDate: new Date("2020-01-01"),
    }); // open and overdue

    const adoptedExperiment = await createExperiment(db, {
      workspaceId,
      actorUserId,
      name: "Landing page A/B test",
      hypothesis: "New headline converts better",
      method: "50/50 split test",
    });
    await updateExperiment(db, {
      workspaceId,
      actorUserId,
      experimentId: adoptedExperiment.id,
      status: "completed",
      decision: "adopt",
    });
    await createExperiment(db, {
      workspaceId,
      actorUserId,
      name: "Pricing test",
      hypothesis: "Higher price increases revenue",
      method: "Cohort comparison",
    }); // stays planned, no decision

    await createBusinessMetric(db, {
      workspaceId,
      actorUserId,
      name: "Monthly recurring revenue",
      unit: "usd",
      direction: "increase",
      cadence: "monthly",
      baselineValue: 1000,
      targetValue: 2000,
      currentValue: 1500,
    });
    await createBusinessMetric(db, {
      workspaceId,
      actorUserId,
      name: "Churn rate",
      unit: "%",
      direction: "decrease",
      cadence: "monthly",
      baselineValue: 10,
      targetValue: 5,
      currentValue: 7.5,
    });
    await createBusinessMetric(db, {
      workspaceId,
      actorUserId,
      name: "Not yet measurable",
      unit: "",
      direction: "increase",
      cadence: "monthly",
    }); // no baseline/target/current at all

    const scorecard = await getWorkspaceScorecard(db, { actorUserId, workspaceId });

    expect(scorecard.goals).toEqual({
      total: 2,
      active: 1,
      achieved: 1,
      abandoned: 0,
      achievementRate: 0.5,
    });

    expect(scorecard.tasks).toEqual({
      total: 2,
      open: 1,
      inProgress: 0,
      done: 1,
      completionRate: 0.5,
      overdueCount: 1,
    });

    expect(scorecard.experiments.total).toBe(2);
    expect(scorecard.experiments.planned).toBe(1);
    expect(scorecard.experiments.completed).toBe(1);
    expect(scorecard.experiments.decisionCounts.adopt).toBe(1);
    expect(scorecard.experiments.decisionCounts.reject).toBe(0);

    expect(scorecard.metrics.total).toBe(3);
    expect(scorecard.metrics.measurable).toBe(2);
    const mrr = scorecard.metrics.metrics.find((m) => m.name === "Monthly recurring revenue");
    const churn = scorecard.metrics.metrics.find((m) => m.name === "Churn rate");
    const unmeasured = scorecard.metrics.metrics.find((m) => m.name === "Not yet measurable");
    expect(mrr?.progress).toBe(0.5);
    expect(churn?.progress).toBe(0.5);
    expect(unmeasured?.progress).toBeNull();
  });
});
