import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { recordAiCall, listAiCallRecords } from "./ai-call-record-use-cases";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("AI call records (Phase 6 tenth slice)", () => {
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
      "ai_call_records",
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

  it("records a call with an estimated cost for a known model", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const record = await recordAiCall(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      promptTemplateKey: "coaching_ask",
      promptTemplateVersion: 1,
      providerId: "anthropic",
      model: "claude-sonnet-5",
      inputTokens: 1000,
      outputTokens: 500,
      latencyMs: 850,
    });

    expect(record.estimatedCostMicros).toBe(1000 * 2 + 500 * 10);
    expect(record.workspaceId).toBe(alice.workspace.id);

    const list = await listAiCallRecords(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(list.map((r) => r.id)).toEqual([record.id]);
  });

  it("records a call with a null estimated cost for an unpriced model", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");

    const record = await recordAiCall(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      promptTemplateKey: "coaching_ask",
      promptTemplateVersion: 1,
      providerId: "deterministic",
      model: "deterministic",
      inputTokens: 10,
      outputTokens: 10,
      latencyMs: 5,
    });

    expect(record.estimatedCostMicros).toBeNull();
  });

  it("records a call with no workspace context (e.g. a lesson explanation)", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");

    const record = await recordAiCall(db, {
      actorUserId: alice.user.id,
      promptTemplateKey: "explain_lesson_block",
      promptTemplateVersion: 1,
      providerId: "deterministic",
      model: "deterministic",
      inputTokens: 20,
      outputTokens: 15,
      latencyMs: 12,
    });

    expect(record.workspaceId).toBeNull();
  });

  it("lists only records for the given workspace, newest first", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const bob = await registerWithWorkspace("bob4@example.com", "Bob Co 4");

    const first = await recordAiCall(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      promptTemplateKey: "coaching_ask",
      promptTemplateVersion: 1,
      providerId: "deterministic",
      model: "deterministic",
      inputTokens: 5,
      outputTokens: 5,
      latencyMs: 5,
    });
    const second = await recordAiCall(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      promptTemplateKey: "coaching_ask",
      promptTemplateVersion: 1,
      providerId: "deterministic",
      model: "deterministic",
      inputTokens: 5,
      outputTokens: 5,
      latencyMs: 5,
    });
    await recordAiCall(db, {
      actorUserId: bob.user.id,
      workspaceId: bob.workspace.id,
      promptTemplateKey: "coaching_ask",
      promptTemplateVersion: 1,
      providerId: "deterministic",
      model: "deterministic",
      inputTokens: 5,
      outputTokens: 5,
      latencyMs: 5,
    });

    const list = await listAiCallRecords(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(list.map((r) => r.id)).toEqual([second.id, first.id]);
  });

  it("prevents a user in one workspace from listing another workspace's AI call records", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    const bob = await registerWithWorkspace("bob5@example.com", "Bob Co 5");

    await expect(
      listAiCallRecords(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
