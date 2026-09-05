import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createTask, listTasks, updateTask, updateTaskStatus } from "./task-use-cases";
import { createProject } from "./project-use-cases";
import { ProjectNotFoundError, TaskBlockerInvalidError, TaskNotFoundError } from "./errors";
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

  it("creates and lists tasks, newest first, starting open with no completedAt", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const first = await createTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Write the plan",
      description: "",
      priority: "medium",
    });
    expect(first.status).toBe("open");
    expect(first.completedAt).toBeNull();

    const second = await createTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Ship it",
      description: "",
      priority: "medium",
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
      priority: "medium",
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
      priority: "medium",
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
      priority: "medium",
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
        priority: "medium",
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

  it("creates a task linked to a project, and updates its project/priority/blocker via updateTask", async () => {
    const alice = await registerWithWorkspace("alice6@example.com", "Alice Co 6");
    const project = await createProject(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Launch",
      description: "",
    });
    const blocker = await createTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Prerequisite task",
      description: "",
      priority: "medium",
    });

    const task = await createTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Ship it",
      description: "",
      projectId: project.id,
      priority: "high",
      blockedByTaskId: blocker.id,
    });
    expect(task.projectId).toBe(project.id);
    expect(task.priority).toBe("high");
    expect(task.blockedByTaskId).toBe(blocker.id);

    const updated = await updateTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      taskId: task.id,
      projectId: null,
      priority: "urgent",
      blockedByTaskId: null,
    });
    expect(updated.projectId).toBeNull();
    expect(updated.priority).toBe("urgent");
    expect(updated.blockedByTaskId).toBeNull();
  });

  it("rejects a projectId that doesn't belong to the workspace", async () => {
    const alice = await registerWithWorkspace("alice7@example.com", "Alice Co 7");
    const bob = await registerWithWorkspace("bob7@example.com", "Bob Co 7");
    const bobsProject = await createProject(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      name: "Bob's project",
      description: "",
    });

    await expect(
      createTask(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        title: "Should fail",
        description: "",
        priority: "medium",
        projectId: bobsProject.id,
      }),
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it("rejects a blockedByTaskId that is the task itself, or belongs to another workspace", async () => {
    const alice = await registerWithWorkspace("alice8@example.com", "Alice Co 8");
    const bob = await registerWithWorkspace("bob8@example.com", "Bob Co 8");
    const bobsTask = await createTask(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      title: "Bob's task",
      description: "",
      priority: "medium",
    });

    await expect(
      createTask(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        title: "Should fail",
        description: "",
        priority: "medium",
        blockedByTaskId: bobsTask.id,
      }),
    ).rejects.toThrow(TaskBlockerInvalidError);

    const task = await createTask(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      title: "Ship it",
      description: "",
      priority: "medium",
    });

    await expect(
      updateTask(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        taskId: task.id,
        blockedByTaskId: task.id,
      }),
    ).rejects.toThrow(TaskBlockerInvalidError);
  });
});
