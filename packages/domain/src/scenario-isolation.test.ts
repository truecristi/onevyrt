import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createAssumption } from "./assumption-use-cases";
import {
  createScenario,
  listScenarios,
  setScenarioOverride,
  removeScenarioOverride,
  resolveScenarioAssumptions,
} from "./scenario-use-cases";
import {
  DuplicateScenarioTypeError,
  ScenarioNotFoundError,
  ScenarioOverrideNotFoundError,
  AssumptionNotFoundError,
} from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("scenario modeling (Phase 4 second slice)", () => {
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
      "scenario_assumption_overrides",
      "scenarios",
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

  it("rejects a non-member creating a scenario", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");
    const bob = await registerWithWorkspace("bob@example.com", "Bob Co");
    await expect(
      createScenario(db, {
        actorUserId: bob.user.id,
        workspaceId: alice.workspace.id,
        name: "Best case",
        scenarioType: "best",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("allows only one base/best/worst scenario per workspace but many custom ones", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");

    await createScenario(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Base case",
      scenarioType: "base",
    });

    await expect(
      createScenario(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        name: "Base case again",
        scenarioType: "base",
      }),
    ).rejects.toThrow(DuplicateScenarioTypeError);

    await createScenario(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Aggressive pricing test",
      scenarioType: "custom",
    });
    const secondCustom = await createScenario(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Conservative pricing test",
      scenarioType: "custom",
    });
    expect(secondCustom.scenarioType).toBe("custom");

    const scenarios = await listScenarios(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
    });
    expect(scenarios).toHaveLength(3);
  });

  it("overrides a scenario's assumption values without touching the baseline, and resolves the full set", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");

    const conversion = await createAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      statement: "Trial-to-paid conversion is 2%",
      description: "",
      source: "",
      sourceType: "estimate-user",
      confidence: "medium",
      unit: "%",
      value: 2,
    });
    const churn = await createAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      statement: "Monthly churn is 5%",
      description: "",
      source: "",
      sourceType: "estimate-user",
      confidence: "medium",
      unit: "%",
      value: 5,
    });

    const best = await createScenario(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Best case",
      scenarioType: "best",
    });

    await setScenarioOverride(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      scenarioId: best.id,
      assumptionId: conversion.id,
      value: 4,
    });

    const resolved = await resolveScenarioAssumptions(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      scenarioId: best.id,
    });
    const conversionRow = resolved.find((r) => r.assumptionId === conversion.id);
    const churnRow = resolved.find((r) => r.assumptionId === churn.id);
    expect(conversionRow).toMatchObject({ baselineValue: 2, scenarioValue: 4, isOverridden: true });
    expect(churnRow).toMatchObject({ baselineValue: 5, scenarioValue: 5, isOverridden: false });

    // The baseline itself never moved.
    const unchangedBaseline = await resolveScenarioAssumptions(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      scenarioId: best.id,
    });
    expect(unchangedBaseline.find((r) => r.assumptionId === conversion.id)?.baselineValue).toBe(2);

    await removeScenarioOverride(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      scenarioId: best.id,
      assumptionId: conversion.id,
    });
    const afterRemoval = await resolveScenarioAssumptions(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      scenarioId: best.id,
    });
    expect(afterRemoval.find((r) => r.assumptionId === conversion.id)).toMatchObject({
      scenarioValue: 2,
      isOverridden: false,
    });

    await expect(
      removeScenarioOverride(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        scenarioId: best.id,
        assumptionId: conversion.id,
      }),
    ).rejects.toThrow(ScenarioOverrideNotFoundError);
  });

  it("rejects overriding an assumption from a different workspace, and a nonexistent scenario", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const bob = await registerWithWorkspace("bob4@example.com", "Bob Co 4");

    const bobsAssumption = await createAssumption(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      statement: "Bob's assumption",
      description: "",
      source: "",
      sourceType: "estimate-user",
      confidence: "medium",
      unit: "",
      value: 1,
    });
    const alicesScenario = await createScenario(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Worst case",
      scenarioType: "worst",
    });

    await expect(
      setScenarioOverride(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        scenarioId: alicesScenario.id,
        assumptionId: bobsAssumption.id,
        value: 99,
      }),
    ).rejects.toThrow(AssumptionNotFoundError);

    await expect(
      resolveScenarioAssumptions(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        scenarioId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(ScenarioNotFoundError);
  });
});
