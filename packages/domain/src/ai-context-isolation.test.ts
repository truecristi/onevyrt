import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { upsertBusinessProfile, createGoal } from "./business-core-use-cases";
import { createAssumption } from "./assumption-use-cases";
import { createDecision } from "./decision-use-cases";
import { assembleWorkspaceContext } from "./ai-context-use-cases";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("AI workspace context assembly (Phase 6 third slice)", () => {
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

  it("assembles only the requested context classes, each with a manifest entry", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");
    await upsertBusinessProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Alice Co",
      vision: "Help founders ship faster",
      mission: "",
      industry: "Software",
      stage: "growing",
    });
    await createGoal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Hit $10k MRR",
      description: "",
    });

    const context = await assembleWorkspaceContext(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      contextClasses: ["business_profile", "goals"],
    });

    expect(context.manifest).toHaveLength(2);
    expect(context.manifest.map((e) => e.recordType).sort()).toEqual(["business_profile", "goals"]);
    expect(context.text).toContain("Alice Co");
    expect(context.text).toContain("Hit $10k MRR");
    // decisions/assumptions weren't requested, so nothing about them leaks in.
    expect(context.text).not.toContain("Decisions");
  });

  it("redacts an assumption's ownerId from the text but records it in the manifest", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    await createAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      statement: "Customers will pay $99/mo",
      description: "",
      source: "",
      confidence: "medium",
      unit: "usd",
      sourceType: "estimate-user",
      ownerId: alice.user.id,
    });

    const context = await assembleWorkspaceContext(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      contextClasses: ["assumptions"],
    });

    expect(context.manifest).toHaveLength(1);
    expect(context.manifest[0]?.redactedFields).toContain("ownerId");
    expect(context.text).not.toContain(alice.user.id);
    expect(context.text).toContain("Customers will pay $99/mo");
  });

  it("includes recent decisions when requested", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    await createDecision(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Raise prices",
      context: "",
      outcome: "Increased to $99/mo",
    });

    const context = await assembleWorkspaceContext(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      contextClasses: ["decisions"],
    });

    expect(context.text).toContain("Raise prices");
    expect(context.text).toContain("Increased to $99/mo");
  });

  it("caps rows per class via limitPerClass", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    for (let i = 0; i < 5; i++) {
      await createGoal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        title: `Goal ${i}`,
        description: "",
      });
    }

    const context = await assembleWorkspaceContext(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      contextClasses: ["goals"],
      limitPerClass: 2,
    });

    expect(context.manifest).toHaveLength(2);
  });

  it("prevents a user in one workspace from assembling another workspace's context", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    const bob = await registerWithWorkspace("bob5@example.com", "Bob Co 5");

    await expect(
      assembleWorkspaceContext(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        contextClasses: ["goals"],
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("returns an empty manifest and text when no context classes are requested, or none of the requested classes have data", async () => {
    const alice = await registerWithWorkspace("alice6@example.com", "Alice Co 6");

    const empty = await assembleWorkspaceContext(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      contextClasses: [],
    });
    expect(empty.manifest).toEqual([]);
    expect(empty.text).toBe("");

    const noData = await assembleWorkspaceContext(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      contextClasses: ["goals", "decisions"],
    });
    expect(noData.manifest).toEqual([]);
    expect(noData.text).toBe("");
  });
});
