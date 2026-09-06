import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { listTasks } from "./task-use-cases";
import {
  createTaskProposal,
  listTaskProposals,
  acceptTaskProposal,
  rejectTaskProposal,
} from "./task-proposal-use-cases";
import {
  InvalidTaskProposalError,
  TaskProposalNotFoundError,
  TaskProposalNotPendingError,
} from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("task proposals (Phase 6 seventh slice)", () => {
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
      "task_proposals",
      "tasks",
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

  const proposalMeta = {
    rationale: "Following up on a recent decision keeps momentum.",
    promptTemplateKey: "propose_task",
    promptTemplateVersion: 1,
    providerId: "deterministic",
    model: "test-model",
  };

  it("creates a proposal after validating the proposed task", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const proposal = await createTaskProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      proposedTask: { title: "Follow up with the customer", priority: "high" },
      ...proposalMeta,
    });

    expect(proposal.status).toBe("pending");
    expect(proposal.proposedTask).toEqual({
      title: "Follow up with the customer",
      description: "",
      priority: "high",
    });

    const list = await listTaskProposals(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(list.map((p) => p.id)).toEqual([proposal.id]);
  });

  it("rejects a proposedTask missing a title", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");

    await expect(
      createTaskProposal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        proposedTask: { description: "No title given" },
        ...proposalMeta,
      }),
    ).rejects.toThrow(InvalidTaskProposalError);
  });

  it("accepting creates a real task and marks the proposal accepted with createdTaskId set", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const proposal = await createTaskProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      proposedTask: { title: "Follow up with the customer" },
      ...proposalMeta,
    });

    const accepted = await acceptTaskProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      proposalId: proposal.id,
    });
    expect(accepted.status).toBe("accepted");
    expect(accepted.createdTaskId).not.toBeNull();
    expect(accepted.reviewedByUserId).toBe(alice.user.id);

    const tasks = await listTasks(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(tasks.map((t) => t.id)).toContain(accepted.createdTaskId);
    expect(tasks[0]?.title).toBe("Follow up with the customer");
  });

  it("rejecting leaves no task created", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const proposal = await createTaskProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      proposedTask: { title: "Should not be created" },
      ...proposalMeta,
    });

    const rejected = await rejectTaskProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      proposalId: proposal.id,
    });
    expect(rejected.status).toBe("rejected");
    expect(rejected.createdTaskId).toBeNull();

    const tasks = await listTasks(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(tasks).toEqual([]);
  });

  it("rejects accepting or rejecting a proposal that isn't pending", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    const proposal = await createTaskProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      proposedTask: { title: "Task" },
      ...proposalMeta,
    });
    await rejectTaskProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      proposalId: proposal.id,
    });

    await expect(
      acceptTaskProposal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        proposalId: proposal.id,
      }),
    ).rejects.toThrow(TaskProposalNotPendingError);
  });

  it("throws TaskProposalNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice6@example.com", "Alice Co 6");
    await expect(
      acceptTaskProposal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        proposalId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(TaskProposalNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's proposals", async () => {
    const alice = await registerWithWorkspace("alice7@example.com", "Alice Co 7");
    const bob = await registerWithWorkspace("bob7@example.com", "Bob Co 7");
    const proposal = await createTaskProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      proposedTask: { title: "Alice's task" },
      ...proposalMeta,
    });

    await expect(
      listTaskProposals(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createTaskProposal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        proposedTask: { title: "Should fail" },
        ...proposalMeta,
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      acceptTaskProposal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        proposalId: proposal.id,
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
