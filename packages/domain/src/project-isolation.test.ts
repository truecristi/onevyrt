import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createProject, listProjects, updateProject } from "./project-use-cases";
import { ProjectNotFoundError } from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("projects (Phase 5 fifth slice)", () => {
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

  it("creates and lists projects, newest first, starting active", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const first = await createProject(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Launch",
      description: "",
    });
    expect(first.status).toBe("active");

    const second = await createProject(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Q2 roadmap",
      description: "",
    });

    const projects = await listProjects(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(projects.map((p) => p.id)).toEqual([second.id, first.id]);
  });

  it("updates name, description, and status", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const project = await createProject(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Launch",
      description: "",
    });

    const updated = await updateProject(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      projectId: project.id,
      name: "Launch v2",
      status: "completed",
    });

    expect(updated.name).toBe("Launch v2");
    expect(updated.status).toBe("completed");
  });

  it("throws ProjectNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    await expect(
      updateProject(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        projectId: "00000000-0000-0000-0000-000000000000",
        name: "Nope",
      }),
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's projects", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const bob = await registerWithWorkspace("bob4@example.com", "Bob Co 4");

    const alicesProject = await createProject(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Alice's project",
      description: "",
    });

    await expect(
      listProjects(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createProject(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        name: "Should fail",
        description: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      updateProject(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        projectId: alicesProject.id,
        name: "Should fail",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
