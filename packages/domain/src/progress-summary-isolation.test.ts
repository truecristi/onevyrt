import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createGoal, updateGoalStatus } from "./business-core-use-cases";
import { createBusinessMetric, updateBusinessMetric } from "./business-metric-use-cases";
import { upsertWeeklyReview } from "./weekly-review-use-cases";
import { getProgressSummary } from "./progress-summary-use-cases";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("progress summaries (Phase 7 fifth slice)", () => {
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
      "weekly_reviews",
      "business_metrics",
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
      getProgressSummary(db, { actorUserId: bob.user.id, workspaceId: alice.workspace.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("reports no comparison when there is no weekly review history", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    await createGoal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Launch v2",
      description: "",
    });

    const summary = await getProgressSummary(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
    });

    expect(summary.hasComparison).toBe(false);
    expect(summary.comparisonWeekStartDate).toBeNull();
    expect(summary.goalsAchievementRate).toEqual({ current: 0, previous: null, delta: null });
    expect(summary.metrics).toEqual([]);
  });

  it("compares the current scorecard against the closest weekly review at or before the requested weeks back", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const workspaceId = alice.workspace.id;
    const actorUserId = alice.user.id;

    const goal = await createGoal(db, {
      workspaceId,
      actorUserId,
      title: "Reach $10k MRR",
      description: "",
    });
    const metric = await createBusinessMetric(db, {
      workspaceId,
      actorUserId,
      name: "Monthly recurring revenue",
      unit: "usd",
      direction: "increase",
      cadence: "monthly",
      baselineValue: 1000,
      targetValue: 2000,
      currentValue: 1200, // progress 0.2 at snapshot time
    });

    // Save a review 5 weeks ago - further back than the default 4-week
    // comparison window, so it's still the closest available baseline
    // (the "closest at or before" degrade-gracefully behavior).
    const fiveWeeksAgo = new Date(Date.now() - 5 * 7 * MS_PER_DAY);
    const oldReview = await upsertWeeklyReview(db, {
      workspaceId,
      actorUserId,
      weekOf: fiveWeeksAgo,
      wins: "",
      challenges: "",
      focusNextWeek: "",
    });
    expect(oldReview.scorecardSnapshot.goals.achievementRate).toBe(0);
    expect(
      oldReview.scorecardSnapshot.metrics.metrics.find((m) => m.id === metric.id)?.progress,
    ).toBe(0.2);

    // Progress since that snapshot: the goal is achieved, and the metric
    // has moved further toward its target.
    await updateGoalStatus(db, { workspaceId, actorUserId, goalId: goal.id, status: "achieved" });
    await updateBusinessMetric(db, {
      workspaceId,
      actorUserId,
      metricId: metric.id,
      currentValue: 1600, // progress 0.6 now
    });

    const summary = await getProgressSummary(db, { actorUserId, workspaceId, weeksBack: 4 });

    expect(summary.hasComparison).toBe(true);
    expect(summary.comparisonWeekStartDate?.getTime()).toBe(oldReview.weekStartDate.getTime());
    expect(summary.goalsAchievementRate).toEqual({ current: 1, previous: 0, delta: 1 });

    const metricChange = summary.metrics.find((m) => m.metricId === metric.id);
    expect(metricChange?.previousProgress).toBe(0.2);
    expect(metricChange?.currentProgress).toBe(0.6);
    expect(metricChange?.delta).toBeCloseTo(0.4);
  });
});
