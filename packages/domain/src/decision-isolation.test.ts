import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createDecision, listDecisions, updateDecision } from "./decision-use-cases";
import { DecisionNotFoundError } from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("decisions (Phase 2 eighth slice)", () => {
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

  it("creates and lists decisions newest first, starting proposed with no decidedAt", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const first = await createDecision(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Raise prices 10%",
      context: "Margins are thin at current pricing",
      outcome: "",
    });
    expect(first.status).toBe("proposed");
    expect(first.decidedAt).toBeNull();

    const second = await createDecision(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Drop the legacy offer",
      context: "",
      outcome: "",
    });

    const decisions = await listDecisions(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(decisions.map((d) => d.id)).toEqual([second.id, first.id]);
  });

  it("sets decidedAt when a decision is marked decided", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const decision = await createDecision(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Raise prices 10%",
      context: "",
      outcome: "",
    });

    const decided = await updateDecision(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      decisionId: decision.id,
      status: "decided",
      outcome: "Raised prices from $49 to $54",
    });

    expect(decided.status).toBe("decided");
    expect(decided.decidedAt).not.toBeNull();
    expect(decided.outcome).toBe("Raised prices from $49 to $54");
  });

  it("clears decidedAt when a decided decision is later reversed", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const decision = await createDecision(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Raise prices 10%",
      context: "",
      outcome: "",
    });

    await updateDecision(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      decisionId: decision.id,
      status: "decided",
    });

    const reversed = await updateDecision(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      decisionId: decision.id,
      status: "reversed",
    });

    expect(reversed.status).toBe("reversed");
    expect(reversed.decidedAt).toBeNull();
  });

  it("throws DecisionNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    await expect(
      updateDecision(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        decisionId: "00000000-0000-0000-0000-000000000000",
        status: "decided",
      }),
    ).rejects.toThrow(DecisionNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's decisions", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    const bob = await registerWithWorkspace("bob5@example.com", "Bob Co 5");

    const alicesDecision = await createDecision(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Alice's decision",
      context: "",
      outcome: "",
    });

    await expect(
      listDecisions(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createDecision(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        title: "Should fail",
        context: "",
        outcome: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      updateDecision(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        decisionId: alicesDecision.id,
        status: "decided",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
