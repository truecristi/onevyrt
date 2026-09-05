import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createOffer, listOffers, updateOffer } from "./offer-use-cases";
import { OfferNotFoundError } from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "c".repeat(64);

describe("offers (Phase 2 third slice)", () => {
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

  it("creates an offer with a price and lists it, newest first", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");

    const first = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Starter package",
      description: "",
      currency: "usd",
      priceCents: 4900,
    });
    const second = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "No price yet",
      description: "",
      currency: "usd",
    });
    expect(second.priceCents).toBeNull();

    const offers = await listOffers(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(offers.map((o) => o.id)).toEqual([second.id, first.id]);
    expect(offers[1]?.priceCents).toBe(4900);
    expect(offers[1]?.status).toBe("draft");
  });

  it("distinguishes 'leave price unchanged' from 'clear the price' on update", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Starter package",
      description: "",
      currency: "usd",
      priceCents: 4900,
    });

    // Updating only the status must not touch the price.
    const statusOnly = await updateOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      offerId: offer.id,
      status: "active",
    });
    expect(statusOnly.priceCents).toBe(4900);
    expect(statusOnly.status).toBe("active");

    // Explicitly clearing the price must set it to null, not leave it alone.
    const cleared = await updateOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      offerId: offer.id,
      priceCents: null,
    });
    expect(cleared.priceCents).toBeNull();
    expect(cleared.status).toBe("active"); // untouched by this update
  });

  it("throws OfferNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    await expect(
      updateOffer(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        offerId: "00000000-0000-0000-0000-000000000000",
        status: "archived",
      }),
    ).rejects.toThrow(OfferNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's offers", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const bob = await registerWithWorkspace("bob4@example.com", "Bob Co 4");

    const alicesOffer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Alice's offer",
      description: "",
      currency: "usd",
      priceCents: 1000,
    });

    await expect(
      listOffers(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createOffer(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        name: "Should fail",
        description: "",
        currency: "usd",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      updateOffer(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        offerId: alicesOffer.id,
        priceCents: 1,
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
