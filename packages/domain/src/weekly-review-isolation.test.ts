import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createGoal, updateGoalStatus } from "./business-core-use-cases";
import {
  getWeeklyReview,
  listWeeklyReviews,
  toWeekStart,
  upsertWeeklyReview,
} from "./weekly-review-use-cases";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("weekly reviews (Phase 7 second slice)", () => {
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

  it("normalizes any day in a week to that week's Monday", () => {
    // Wednesday 2026-09-02 and Sunday 2026-09-06 both fall in the week
    // starting Monday 2026-08-31.
    expect(toWeekStart(new Date("2026-09-02T15:00:00Z")).toISOString()).toBe(
      "2026-08-31T00:00:00.000Z",
    );
    expect(toWeekStart(new Date("2026-09-06T23:59:00Z")).toISOString()).toBe(
      "2026-08-31T00:00:00.000Z",
    );
    // A Monday normalizes to itself, at midnight UTC.
    expect(toWeekStart(new Date("2026-08-31T09:30:00Z")).toISOString()).toBe(
      "2026-08-31T00:00:00.000Z",
    );
  });

  it("rejects a non-member for every operation", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");
    const bob = await registerWithWorkspace("bob@example.com", "Bob Co");

    await expect(
      upsertWeeklyReview(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        weekOf: new Date(),
        wins: "",
        challenges: "",
        focusNextWeek: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      listWeeklyReviews(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      getWeeklyReview(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        weekOf: new Date(),
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("returns null from getWeeklyReview for a week nobody has saved yet", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const review = await getWeeklyReview(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      weekOf: new Date(),
    });
    expect(review).toBeNull();
  });

  it("creates a review, freezes a scorecard snapshot, and upserts on a second save for the same week", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const workspaceId = alice.workspace.id;
    const actorUserId = alice.user.id;

    const goal = await createGoal(db, {
      workspaceId,
      actorUserId,
      title: "Launch v2",
      description: "",
    });

    const firstSave = await upsertWeeklyReview(db, {
      workspaceId,
      actorUserId,
      weekOf: new Date("2026-09-02T12:00:00Z"), // a Wednesday
      wins: "Shipped the new pricing page",
      challenges: "Slower than expected launch",
      focusNextWeek: "Run the pricing experiment",
    });

    expect(firstSave.weekStartDate.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(firstSave.scorecardSnapshot.goals).toEqual({
      total: 1,
      active: 1,
      achieved: 0,
      abandoned: 0,
      achievementRate: 0,
    });

    // Achieve the goal, then save again for a different day in the same
    // week - this should update the same row, not create a second one,
    // and the snapshot should reflect the new goal state.
    await updateGoalStatus(db, { workspaceId, actorUserId, goalId: goal.id, status: "achieved" });

    const secondSave = await upsertWeeklyReview(db, {
      workspaceId,
      actorUserId,
      weekOf: new Date("2026-09-06T09:00:00Z"), // the Sunday of the same week
      wins: "Also validated the pricing experiment",
      challenges: "",
      focusNextWeek: "Plan next month",
    });

    expect(secondSave.id).toBe(firstSave.id);
    expect(secondSave.wins).toBe("Also validated the pricing experiment");
    expect(secondSave.scorecardSnapshot.goals.achieved).toBe(1);

    const all = await listWeeklyReviews(db, { workspaceId, actorUserId });
    expect(all).toHaveLength(1);

    const fetched = await getWeeklyReview(db, {
      workspaceId,
      actorUserId,
      weekOf: new Date("2026-09-03T00:00:00Z"),
    });
    expect(fetched?.id).toBe(firstSave.id);
    expect(fetched?.wins).toBe("Also validated the pricing experiment");
  });

  it("lists reviews for different weeks newest week first", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const workspaceId = alice.workspace.id;
    const actorUserId = alice.user.id;

    await upsertWeeklyReview(db, {
      workspaceId,
      actorUserId,
      weekOf: new Date("2026-08-24T00:00:00Z"),
      wins: "Week 1",
      challenges: "",
      focusNextWeek: "",
    });
    await upsertWeeklyReview(db, {
      workspaceId,
      actorUserId,
      weekOf: new Date("2026-09-07T00:00:00Z"),
      wins: "Week 3",
      challenges: "",
      focusNextWeek: "",
    });
    await upsertWeeklyReview(db, {
      workspaceId,
      actorUserId,
      weekOf: new Date("2026-08-31T00:00:00Z"),
      wins: "Week 2",
      challenges: "",
      focusNextWeek: "",
    });

    const all = await listWeeklyReviews(db, { workspaceId, actorUserId });
    expect(all.map((r) => r.wins)).toEqual(["Week 3", "Week 2", "Week 1"]);
  });
});
