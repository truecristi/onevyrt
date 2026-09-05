import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createTask, listTasks, updateTaskStatus } from "./task-use-cases";
import { TaskNotFoundError } from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("tasks (Phase 2 fourth slice)", () => {
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

  it("creates and lists tasks, newest first, starting open with no completedAt", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const first = await createTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Write the plan",
      description: "",
    });
    expect(first.status).toBe("open");
    expect(first.completedAt).toBeNull();

    const second = await createTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Ship it",
      description: "",
    });

    const tasks = await listTasks(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(tasks.map((t) => t.id)).toEqual([second.id, first.id]);
  });

  it("sets completedAt when a task is marked done", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const task = await createTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Ship it",
      description: "",
    });

    const done = await updateTaskStatus(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      taskId: task.id,
      status: "done",
    });

    expect(done.status).toBe("done");
    expect(done.completedAt).not.toBeNull();
  });

  it("clears completedAt when a done task is moved back to open", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const task = await createTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Ship it",
      description: "",
    });

    await updateTaskStatus(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      taskId: task.id,
      status: "done",
    });

    const reopened = await updateTaskStatus(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      taskId: task.id,
      status: "open",
    });

    expect(reopened.status).toBe("open");
    expect(reopened.completedAt).toBeNull();
  });

  it("throws TaskNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    await expect(
      updateTaskStatus(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        taskId: "00000000-0000-0000-0000-000000000000",
        status: "done",
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's tasks", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    const bob = await registerWithWorkspace("bob5@example.com", "Bob Co 5");

    const alicesTask = await createTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Alice's task",
      description: "",
    });

    await expect(
      listTasks(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createTask(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        title: "Should fail",
        description: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      updateTaskStatus(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        taskId: alicesTask.id,
        status: "done",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
