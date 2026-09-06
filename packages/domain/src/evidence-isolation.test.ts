import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createAssumption } from "./assumption-use-cases";
import { createDecision } from "./decision-use-cases";
import { createExperiment } from "./experiment-use-cases";
import { createEvidence, listEvidence, updateEvidence } from "./evidence-use-cases";
import {
  AssumptionNotFoundError,
  DecisionNotFoundError,
  EvidenceNotFoundError,
  ExperimentNotFoundError,
} from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("evidence (Phase 2 ninth slice)", () => {
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
      "evidence",
      "experiments",
      "decisions",
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

  it("creates and lists evidence newest first, with no links by default", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const first = await createEvidence(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Customer interview notes",
      description: "",
      sourceUrl: "",
      strength: "moderate",
    });
    expect(first.assumptionId).toBeNull();
    expect(first.decisionId).toBeNull();

    const second = await createEvidence(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Pricing survey results",
      description: "",
      sourceUrl: "https://example.com/survey",
      strength: "strong",
    });

    const items = await listEvidence(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(items.map((e) => e.id)).toEqual([second.id, first.id]);
  });

  it("links evidence to an assumption and a decision in the same workspace", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const assumption = await createAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      statement: "Conversion is 2%",
      description: "",
      source: "",
      sourceType: "estimate-user",
      confidence: "medium",
      unit: "%",
    });
    const decision = await createDecision(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Raise prices",
      context: "",
      outcome: "",
    });

    const item = await createEvidence(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Survey backing the conversion assumption",
      description: "",
      sourceUrl: "",
      strength: "strong",
      assumptionId: assumption.id,
      decisionId: decision.id,
    });

    expect(item.assumptionId).toBe(assumption.id);
    expect(item.decisionId).toBe(decision.id);

    const detached = await updateEvidence(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      evidenceId: item.id,
      assumptionId: null,
    });
    expect(detached.assumptionId).toBeNull();
    expect(detached.decisionId).toBe(decision.id);
  });

  it("rejects linking to an assumption or decision from a different workspace", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const bob = await registerWithWorkspace("bob3@example.com", "Bob Co 3");

    const bobsAssumption = await createAssumption(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      statement: "Bob's assumption",
      description: "",
      source: "",
      sourceType: "estimate-user",
      confidence: "medium",
      unit: "",
    });
    const bobsDecision = await createDecision(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      title: "Bob's decision",
      context: "",
      outcome: "",
    });

    await expect(
      createEvidence(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        title: "Should fail",
        description: "",
        sourceUrl: "",
        strength: "moderate",
        assumptionId: bobsAssumption.id,
      }),
    ).rejects.toThrow(AssumptionNotFoundError);

    await expect(
      createEvidence(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        title: "Should also fail",
        description: "",
        sourceUrl: "",
        strength: "moderate",
        decisionId: bobsDecision.id,
      }),
    ).rejects.toThrow(DecisionNotFoundError);
  });

  it("throws EvidenceNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    await expect(
      updateEvidence(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        evidenceId: "00000000-0000-0000-0000-000000000000",
        title: "Should fail",
      }),
    ).rejects.toThrow(EvidenceNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's evidence", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    const bob = await registerWithWorkspace("bob5@example.com", "Bob Co 5");

    const alicesEvidence = await createEvidence(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Alice's evidence",
      description: "",
      sourceUrl: "",
      strength: "moderate",
    });

    await expect(
      listEvidence(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createEvidence(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        title: "Should fail",
        description: "",
        sourceUrl: "",
        strength: "moderate",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      updateEvidence(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        evidenceId: alicesEvidence.id,
        title: "Should fail",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("links evidence to an experiment in the same workspace, and rejects one from a different workspace", async () => {
    const alice = await registerWithWorkspace("alice6@example.com", "Alice Co 6");
    const bob = await registerWithWorkspace("bob6@example.com", "Bob Co 6");

    const experiment = await createExperiment(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Pricing test",
      hypothesis: "",
      method: "",
    });

    const item = await createEvidence(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Result of the pricing test",
      description: "",
      sourceUrl: "",
      strength: "strong",
      experimentId: experiment.id,
    });
    expect(item.experimentId).toBe(experiment.id);

    const detached = await updateEvidence(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      evidenceId: item.id,
      experimentId: null,
    });
    expect(detached.experimentId).toBeNull();

    const bobsExperiment = await createExperiment(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      name: "Bob's experiment",
      hypothesis: "",
      method: "",
    });

    await expect(
      createEvidence(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        title: "Should fail",
        description: "",
        sourceUrl: "",
        strength: "moderate",
        experimentId: bobsExperiment.id,
      }),
    ).rejects.toThrow(ExperimentNotFoundError);
  });
});
