import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import {
  createCustomerProfile,
  listCustomerProfiles,
  updateCustomerProfile,
} from "./customer-profile-use-cases";
import { CustomerProfileNotFoundError } from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "d".repeat(64);

describe("customer profiles (Phase 2 second slice)", () => {
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

  it("creates and lists customer profiles, newest first", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const first = await createCustomerProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Busy solo founder",
      description: "",
      painPoints: "No time for marketing",
      desiredOutcome: "Predictable leads",
    });
    const second = await createCustomerProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Growing team lead",
      description: "",
      painPoints: "",
      desiredOutcome: "",
    });

    const profiles = await listCustomerProfiles(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(profiles.map((p) => p.id)).toEqual([second.id, first.id]);
  });

  it("partially updates a customer profile, leaving omitted fields unchanged", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const created = await createCustomerProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Busy solo founder",
      description: "Runs everything alone",
      painPoints: "No time",
      desiredOutcome: "More time",
    });

    const updated = await updateCustomerProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      customerProfileId: created.id,
      painPoints: "No time for marketing specifically",
    });

    expect(updated.painPoints).toBe("No time for marketing specifically");
    // Untouched fields survive the partial update.
    expect(updated.description).toBe("Runs everything alone");
    expect(updated.desiredOutcome).toBe("More time");
  });

  it("throws CustomerProfileNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    await expect(
      updateCustomerProfile(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        customerProfileId: "00000000-0000-0000-0000-000000000000",
        name: "Should fail",
      }),
    ).rejects.toThrow(CustomerProfileNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's customer profiles", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const bob = await registerWithWorkspace("bob4@example.com", "Bob Co 4");

    const alicesProfile = await createCustomerProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Alice's customer",
      description: "",
      painPoints: "",
      desiredOutcome: "",
    });

    await expect(
      listCustomerProfiles(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createCustomerProfile(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        name: "Should fail",
        description: "",
        painPoints: "",
        desiredOutcome: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    // Bob cannot update Alice's profile even from his own workspace context - the
    // membership check on Alice's workspace fails before the row is scoped by ID.
    await expect(
      updateCustomerProfile(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        customerProfileId: alicesProfile.id,
        name: "Hijacked",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("builds out a customer profile's positioning fields, defaulting to empty", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");

    const bare = await createCustomerProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Overwhelmed solo coach",
      description: "",
      painPoints: "",
      desiredOutcome: "",
    });
    expect(bare.emotionalConsequence).toBe("");
    expect(bare.uniqueMechanism).toBe("");
    expect(bare.proof).toBe("");
    expect(bare.callToAction).toBe("");
    expect(bare.positioningStatement).toBe("");

    const built = await createCustomerProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Burned-out solo coach",
      description: "",
      painPoints: "Too many 1:1 calls",
      desiredOutcome: "More free time",
      emotionalConsequence: "Feels like they're failing their family",
      uniqueMechanism: "Group leverage system",
      proof: "200 coaches already switched",
      callToAction: "Book a call",
      positioningStatement: "For coaches who are done trading time for money",
    });
    expect(built.emotionalConsequence).toBe("Feels like they're failing their family");
    expect(built.positioningStatement).toBe("For coaches who are done trading time for money");

    const revised = await updateCustomerProfile(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      customerProfileId: built.id,
      callToAction: "Join the waitlist",
    });
    expect(revised.callToAction).toBe("Join the waitlist");
    // Untouched fields survive the update unchanged.
    expect(revised.uniqueMechanism).toBe("Group leverage system");
    expect(revised.positioningStatement).toBe("For coaches who are done trading time for money");
  });
});
