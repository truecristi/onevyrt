import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createTask, updateTaskStatus } from "./task-use-cases";
import { createBusinessMetric, updateBusinessMetric } from "./business-metric-use-cases";
import { upsertForceAssessment } from "./force-assessment-use-cases";
import {
  closeImprovementLoop,
  listImprovementLoops,
  startImprovementLoop,
} from "./improvement-loop-use-cases";
import {
  ImprovementLoopAlreadyClosedError,
  ImprovementLoopNotFoundError,
  TaskNotFoundError,
} from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("improvement loops (Phase 7 seventh slice)", () => {
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
      "improvement_loops",
      "force_assessments",
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

  it("rejects a non-member for every operation", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");
    const bob = await registerWithWorkspace("bob@example.com", "Bob Co");

    await expect(
      startImprovementLoop(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        source: "overdue_tasks",
        relatedId: null,
        title: "Clear overdue tasks",
        rationale: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      listImprovementLoops(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      closeImprovementLoop(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        loopId: "00000000-0000-0000-0000-000000000000",
        outcomeNote: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("rejects starting a loop linked to a task from another workspace", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const bob = await registerWithWorkspace("bob2@example.com", "Bob Co 2");
    const bobsTask = await createTask(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      title: "Bob's task",
      description: "",
      priority: "medium",
    });

    await expect(
      startImprovementLoop(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        source: "overdue_tasks",
        relatedId: null,
        title: "Clear overdue tasks",
        rationale: "",
        taskId: bobsTask.id,
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it("captures a baseline for a lagging metric, closes the loop after real progress, and reports improved: true", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const workspaceId = alice.workspace.id;
    const actorUserId = alice.user.id;

    const metric = await createBusinessMetric(db, {
      workspaceId,
      actorUserId,
      name: "Monthly recurring revenue",
      unit: "usd",
      direction: "increase",
      cadence: "monthly",
      baselineValue: 1000,
      targetValue: 2000,
      currentValue: 1200, // progress 0.2
    });
    const task = await createTask(db, {
      workspaceId,
      actorUserId,
      title: "Run a pricing experiment",
      description: "",
      priority: "high",
    });

    const loop = await startImprovementLoop(db, {
      workspaceId,
      actorUserId,
      source: "lagging_metric",
      relatedId: metric.id,
      title: "Focus on Monthly recurring revenue",
      rationale: "Only 20% of the way to target",
      taskId: task.id,
    });
    expect(loop.status).toBe("open");
    expect(loop.baselineValue).toBe(0.2);
    expect(loop.taskId).toBe(task.id);

    await updateTaskStatus(db, { workspaceId, actorUserId, taskId: task.id, status: "done" });
    await updateBusinessMetric(db, {
      workspaceId,
      actorUserId,
      metricId: metric.id,
      currentValue: 1600, // progress 0.6
    });

    const closed = await closeImprovementLoop(db, {
      workspaceId,
      actorUserId,
      loopId: loop.id,
      outcomeNote: "Ran the experiment and revenue climbed",
    });
    expect(closed.status).toBe("closed");
    expect(closed.closeValue).toBe(0.6);
    expect(closed.improved).toBe(true);
    expect(closed.closedAt).not.toBeNull();

    const all = await listImprovementLoops(db, { workspaceId, actorUserId });
    expect(all).toHaveLength(1);
    expect(all[0]?.status).toBe("closed");
  });

  it("reports improved: false when a lower-is-better signal (overdue tasks) doesn't improve, and improved: true for a higher-is-better signal (a force's score)", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const workspaceId = alice.workspace.id;
    const actorUserId = alice.user.id;

    await createTask(db, {
      workspaceId,
      actorUserId,
      title: "Overdue task",
      description: "",
      priority: "medium",
      dueDate: new Date("2020-01-01"),
    });

    const overdueLoop = await startImprovementLoop(db, {
      workspaceId,
      actorUserId,
      source: "overdue_tasks",
      relatedId: null,
      title: "Clear overdue tasks",
      rationale: "",
    });
    expect(overdueLoop.baselineValue).toBe(1);

    // No actual progress made - the overdue task is still overdue at close time.
    const closedOverdueLoop = await closeImprovementLoop(db, {
      workspaceId,
      actorUserId,
      loopId: overdueLoop.id,
      outcomeNote: "Didn't get to it",
    });
    expect(closedOverdueLoop.closeValue).toBe(1);
    expect(closedOverdueLoop.improved).toBe(false);

    await upsertForceAssessment(db, {
      workspaceId,
      actorUserId,
      force: "sales_marketing",
      score: 30,
      confidence: "high",
      evidence: "",
      constraintNote: "",
      recommendations: "",
    });
    const constraintLoop = await startImprovementLoop(db, {
      workspaceId,
      actorUserId,
      source: "constraint_diagnosis",
      relatedId: "sales_marketing",
      title: "Address sales & marketing",
      rationale: "",
    });
    expect(constraintLoop.baselineValue).toBe(30);

    await upsertForceAssessment(db, {
      workspaceId,
      actorUserId,
      force: "sales_marketing",
      score: 55,
      confidence: "high",
      evidence: "",
      constraintNote: "",
      recommendations: "",
    });
    const closedConstraintLoop = await closeImprovementLoop(db, {
      workspaceId,
      actorUserId,
      loopId: constraintLoop.id,
      outcomeNote: "Found a repeatable channel",
    });
    expect(closedConstraintLoop.closeValue).toBe(55);
    expect(closedConstraintLoop.improved).toBe(true);
  });

  it("throws closing a nonexistent loop or one that's already closed", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    const workspaceId = alice.workspace.id;
    const actorUserId = alice.user.id;

    await expect(
      closeImprovementLoop(db, {
        workspaceId,
        actorUserId,
        loopId: "00000000-0000-0000-0000-000000000000",
        outcomeNote: "",
      }),
    ).rejects.toThrow(ImprovementLoopNotFoundError);

    const loop = await startImprovementLoop(db, {
      workspaceId,
      actorUserId,
      source: "overdue_tasks",
      relatedId: null,
      title: "Clear overdue tasks",
      rationale: "",
    });
    await closeImprovementLoop(db, { workspaceId, actorUserId, loopId: loop.id, outcomeNote: "" });

    await expect(
      closeImprovementLoop(db, { workspaceId, actorUserId, loopId: loop.id, outcomeNote: "again" }),
    ).rejects.toThrow(ImprovementLoopAlreadyClosedError);
  });
});
