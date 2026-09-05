import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createOffer } from "./offer-use-cases";
import { createLaunch, listLaunches, updateLaunch } from "./launch-use-cases";
import { LaunchNotFoundError, OfferNotFoundError } from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("launches (Phase 5 eighth slice)", () => {
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
      "launches",
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

  it("creates and lists launches, newest first, starting planning with an empty checklist", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const first = await createLaunch(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Q1 launch",
      notes: "",
      checklist: [],
    });
    expect(first.status).toBe("planning");
    expect(first.checklist).toEqual([]);

    const second = await createLaunch(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Q2 launch",
      notes: "",
      checklist: [],
    });

    const launches = await listLaunches(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(launches.map((l) => l.id)).toEqual([second.id, first.id]);
  });

  it("links a launch to a real offer, sets a checklist and status, and replaces the checklist wholesale on update", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching program",
      description: "",
      currency: "usd",
    });

    const launch = await createLaunch(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching launch",
      offerId: offer.id,
      notes: "",
      checklist: [
        { label: "Write sales page", done: false },
        { label: "Record webinar", done: false },
      ],
    });
    expect(launch.offerId).toBe(offer.id);
    expect(launch.checklist).toHaveLength(2);

    const updated = await updateLaunch(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      launchId: launch.id,
      status: "scheduled",
      checklist: [{ label: "Write sales page", done: true }],
    });
    expect(updated.status).toBe("scheduled");
    expect(updated.checklist).toEqual([{ label: "Write sales page", done: true }]);
  });

  it("rejects an offerId that doesn't belong to the workspace", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const bob = await registerWithWorkspace("bob3@example.com", "Bob Co 3");
    const bobsOffer = await createOffer(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      name: "Bob's offer",
      description: "",
      currency: "usd",
    });

    await expect(
      createLaunch(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        name: "Should fail",
        offerId: bobsOffer.id,
        notes: "",
        checklist: [],
      }),
    ).rejects.toThrow(OfferNotFoundError);
  });

  it("throws LaunchNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    await expect(
      updateLaunch(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        launchId: "00000000-0000-0000-0000-000000000000",
        status: "live",
      }),
    ).rejects.toThrow(LaunchNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's launches", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    const bob = await registerWithWorkspace("bob5@example.com", "Bob Co 5");

    const alicesLaunch = await createLaunch(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Alice's launch",
      notes: "",
      checklist: [],
    });

    await expect(
      listLaunches(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createLaunch(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        name: "Should fail",
        notes: "",
        checklist: [],
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      updateLaunch(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        launchId: alicesLaunch.id,
        status: "live",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
