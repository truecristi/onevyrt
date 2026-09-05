import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import {
  createFunnelStage,
  listFunnelStages,
  updateFunnelStage,
  deleteFunnelStage,
  calculateFunnelRequirements,
} from "./funnel-stage-use-cases";
import {
  DuplicateFunnelStageOrderError,
  FunnelStageNotFoundError,
  FunnelHasNoStagesError,
  MissingConversionRateError,
} from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("funnel mathematics (Phase 4 third slice)", () => {
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
      "funnel_stages",
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

  it("rejects a non-member creating a funnel stage", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");
    const bob = await registerWithWorkspace("bob@example.com", "Bob Co");
    await expect(
      createFunnelStage(db, {
        actorUserId: bob.user.id,
        workspaceId: alice.workspace.id,
        name: "Traffic",
        orderIndex: 0,
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("rejects a duplicate stage position, updates and deletes a stage", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");

    const traffic = await createFunnelStage(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Traffic",
      orderIndex: 0,
    });

    await expect(
      createFunnelStage(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        name: "Duplicate position",
        orderIndex: 0,
      }),
    ).rejects.toThrow(DuplicateFunnelStageOrderError);

    const renamed = await updateFunnelStage(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      funnelStageId: traffic.id,
      name: "Website traffic",
    });
    expect(renamed.name).toBe("Website traffic");

    await deleteFunnelStage(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      funnelStageId: traffic.id,
    });

    const stages = await listFunnelStages(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
    });
    expect(stages).toHaveLength(0);

    await expect(
      deleteFunnelStage(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        funnelStageId: traffic.id,
      }),
    ).rejects.toThrow(FunnelStageNotFoundError);
  });

  it("calculates required volume at every stage backward from a target, ordered top to bottom", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");

    await createFunnelStage(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Traffic",
      orderIndex: 0,
    });
    await createFunnelStage(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Leads",
      orderIndex: 1,
      conversionRate: 0.1,
    });
    await createFunnelStage(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Sales",
      orderIndex: 2,
      conversionRate: 0.2,
    });

    const requirements = await calculateFunnelRequirements(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      targetAtFinalStage: 50,
    });

    expect(requirements.map((r) => r.name)).toEqual(["Traffic", "Leads", "Sales"]);
    expect(requirements[2]?.requiredCount).toBe(50);
    expect(requirements[1]?.requiredCount).toBeCloseTo(250); // 50 / 0.2
    expect(requirements[0]?.requiredCount).toBeCloseTo(2500); // 250 / 0.1
  });

  it("rejects calculating against an empty funnel or one with a missing conversion rate", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");

    await expect(
      calculateFunnelRequirements(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        targetAtFinalStage: 10,
      }),
    ).rejects.toThrow(FunnelHasNoStagesError);

    await createFunnelStage(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Traffic",
      orderIndex: 0,
    });
    await createFunnelStage(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Sales",
      orderIndex: 1,
      // no conversionRate set
    });

    await expect(
      calculateFunnelRequirements(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        targetAtFinalStage: 10,
      }),
    ).rejects.toThrow(MissingConversionRateError);
  });
});
