import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createAssumption } from "./assumption-use-cases";
import { createExperiment, listExperiments, updateExperiment } from "./experiment-use-cases";
import {
  AssumptionNotFoundError,
  ExperimentNotFoundError,
  ExperimentOwnerNotInWorkspaceError,
} from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("experiments (Phase 5 sixth slice)", () => {
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
      "experiments",
      "assumptions",
      "tasks",
      "projects",
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

  it("creates and lists experiments, newest first, starting planned", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const first = await createExperiment(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Landing page test",
      hypothesis: "A shorter headline converts better",
      method: "A/B test 50/50 for two weeks",
    });
    expect(first.status).toBe("planned");
    expect(first.startedAt).toBeNull();
    expect(first.endedAt).toBeNull();

    const second = await createExperiment(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Pricing test",
      hypothesis: "",
      method: "",
    });

    const experiments = await listExperiments(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(experiments.map((e) => e.id)).toEqual([second.id, first.id]);
  });

  it("sets startedAt on first move to running, and endedAt on first move to completed", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const experiment = await createExperiment(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Landing page test",
      hypothesis: "",
      method: "",
    });

    const running = await updateExperiment(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      experimentId: experiment.id,
      status: "running",
    });
    expect(running.startedAt).not.toBeNull();
    expect(running.endedAt).toBeNull();

    const completed = await updateExperiment(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      experimentId: experiment.id,
      status: "completed",
      result: "Conversion rate up 12%",
      decision: "adopt",
    });
    expect(completed.startedAt).toEqual(running.startedAt);
    expect(completed.endedAt).not.toBeNull();
    expect(completed.result).toBe("Conversion rate up 12%");
    expect(completed.decision).toBe("adopt");
  });

  it("links an experiment to a real assumption, and rejects one from a different workspace", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const bob = await registerWithWorkspace("bob3@example.com", "Bob Co 3");

    const assumption = await createAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      statement: "Customers will pay $99/mo",
      description: "",
      source: "",
      confidence: "medium",
      unit: "usd",
      sourceType: "estimate-user",
    });

    const experiment = await createExperiment(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Pricing test",
      hypothesis: "",
      method: "",
      assumptionId: assumption.id,
    });
    expect(experiment.assumptionId).toBe(assumption.id);

    const bobsAssumption = await createAssumption(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      statement: "Bob's assumption",
      description: "",
      source: "",
      confidence: "medium",
      unit: "",
      sourceType: "estimate-user",
    });

    await expect(
      createExperiment(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        name: "Should fail",
        hypothesis: "",
        method: "",
        assumptionId: bobsAssumption.id,
      }),
    ).rejects.toThrow(AssumptionNotFoundError);
  });

  it("rejects an ownerId who isn't a member of the workspace", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const bob = await registerWithWorkspace("bob4@example.com", "Bob Co 4");

    await expect(
      createExperiment(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        name: "Should fail",
        hypothesis: "",
        method: "",
        ownerId: bob.user.id,
      }),
    ).rejects.toThrow(ExperimentOwnerNotInWorkspaceError);
  });

  it("throws ExperimentNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    await expect(
      updateExperiment(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        experimentId: "00000000-0000-0000-0000-000000000000",
        status: "running",
      }),
    ).rejects.toThrow(ExperimentNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's experiments", async () => {
    const alice = await registerWithWorkspace("alice6@example.com", "Alice Co 6");
    const bob = await registerWithWorkspace("bob6@example.com", "Bob Co 6");

    const alicesExperiment = await createExperiment(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Alice's experiment",
      hypothesis: "",
      method: "",
    });

    await expect(
      listExperiments(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createExperiment(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        name: "Should fail",
        hypothesis: "",
        method: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      updateExperiment(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        experimentId: alicesExperiment.id,
        status: "running",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
