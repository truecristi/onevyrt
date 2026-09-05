import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import {
  upsertBusinessProfile,
  getBusinessProfile,
  createGoal,
  listGoals,
  updateGoalStatus,
} from "./business-core-use-cases";
import { GoalNotFoundError } from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

// Extends Phase 1's workspace-isolation guarantee (see
// auth-workspace-isolation.test.ts) to the Phase 2 business-core tables.
const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "e".repeat(64);

describe("business core (Phase 2 vertical slice)", () => {
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

  it("creates a business profile on first upsert and updates it on the second", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const created = await upsertBusinessProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Alice Co",
      vision: "Help small businesses grow",
      mission: "",
      industry: "coaching",
      stage: "idea",
    });
    expect(created.stage).toBe("idea");

    const updated = await upsertBusinessProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Alice Co",
      vision: "Help small businesses grow, profitably",
      mission: "",
      industry: "coaching",
      stage: "launched",
    });

    expect(updated.id).toBe(created.id); // same row, not a duplicate
    expect(updated.stage).toBe("launched");
    expect(updated.vision).toBe("Help small businesses grow, profitably");

    const fetched = await getBusinessProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(fetched?.id).toBe(created.id);
  });

  it("returns null for a workspace with no business profile yet", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const profile = await getBusinessProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(profile).toBeNull();
  });

  it("creates and lists goals, newest first", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");

    const first = await createGoal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Reach $10k MRR",
      description: "",
    });
    const second = await createGoal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Hire first employee",
      description: "",
    });

    const goals = await listGoals(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(goals.map((g) => g.id)).toEqual([second.id, first.id]);
  });

  it("updates a goal's status", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const goal = await createGoal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Reach $10k MRR",
      description: "",
    });

    const achieved = await updateGoalStatus(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      goalId: goal.id,
      status: "achieved",
    });
    expect(achieved.status).toBe("achieved");
  });

  it("throws GoalNotFoundError for a goal ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    await expect(
      updateGoalStatus(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        goalId: "00000000-0000-0000-0000-000000000000",
        status: "achieved",
      }),
    ).rejects.toThrow(GoalNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's business profile and goals", async () => {
    const alice = await registerWithWorkspace("alice6@example.com", "Alice Co 6");
    const bob = await registerWithWorkspace("bob6@example.com", "Bob Co 6");

    await upsertBusinessProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Alice Co 6",
      vision: "Private vision",
      mission: "",
      industry: "",
      stage: "idea",
    });
    const bobsGoal = await createGoal(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      title: "Bob's private goal",
      description: "",
    });

    // Bob cannot read Alice's business profile.
    await expect(
      getBusinessProfile(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    // Bob cannot list or create goals in Alice's workspace.
    await expect(
      listGoals(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
    await expect(
      createGoal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        title: "Should fail",
        description: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    // Alice cannot update Bob's goal even by guessing its ID, because the
    // membership check on Bob's workspace fails before the row is ever
    // scoped by goalId.
    await expect(
      updateGoalStatus(db, {
        workspaceId: bob.workspace.id,
        actorUserId: alice.user.id,
        goalId: bobsGoal.id,
        status: "abandoned",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
