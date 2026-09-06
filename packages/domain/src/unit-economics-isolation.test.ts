import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createOffer } from "./offer-use-cases";
import { calculateUnitEconomics } from "./unit-economics-use-cases";
import { OfferNotFoundError, OfferPriceRequiredError } from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("unit economics (Phase 4 fourth slice)", () => {
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

  it("rejects a non-member and a nonexistent offer", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");
    const bob = await registerWithWorkspace("bob@example.com", "Bob Co");

    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching package",
      description: "",
      currency: "usd",
      priceCents: 10000,
    });

    await expect(
      calculateUnitEconomics(db, {
        actorUserId: bob.user.id,
        workspaceId: alice.workspace.id,
        offerId: offer.id,
        costPerUnit: 30,
        acquisitionSpend: 500,
        customersAcquired: 10,
        averageOrderValue: 100,
        purchaseFrequencyPerYear: 2,
        customerLifespanYears: 3,
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      calculateUnitEconomics(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        offerId: "00000000-0000-0000-0000-000000000000",
        costPerUnit: 30,
        acquisitionSpend: 500,
        customersAcquired: 10,
        averageOrderValue: 100,
        purchaseFrequencyPerYear: 2,
        customerLifespanYears: 3,
      }),
    ).rejects.toThrow(OfferNotFoundError);
  });

  it("rejects an offer with no price set", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Free consult",
      description: "",
      currency: "usd",
    });

    await expect(
      calculateUnitEconomics(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        offerId: offer.id,
        costPerUnit: 0,
        acquisitionSpend: 500,
        customersAcquired: 10,
        averageOrderValue: 100,
        purchaseFrequencyPerYear: 2,
        customerLifespanYears: 3,
      }),
    ).rejects.toThrow(OfferPriceRequiredError);
  });

  it("computes the full composite report against hand-checked numbers", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching package",
      description: "",
      currency: "usd",
      priceCents: 10000, // $100
    });

    const report = await calculateUnitEconomics(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      offerId: offer.id,
      costPerUnit: 30, // $30
      acquisitionSpend: 500,
      customersAcquired: 10, // CAC = 50
      averageOrderValue: 100,
      purchaseFrequencyPerYear: 2,
      customerLifespanYears: 3, // LTV = 600
      // LTV:CAC = 600 / 50 = 12
    });

    expect(report.price).toBe(100);
    expect(report.grossProfit.value).toBe(70); // 100 - 30
    expect(report.contributionMargin.value).toBeCloseTo(0.7); // (100 - 30) / 100
    expect(report.customerAcquisitionCost.value).toBe(50);
    expect(report.customerLifetimeValue.value).toBe(600);
    expect(report.ltvToCacRatio.value).toBe(12);
    expect(report.grossProfit.unit).toBe("usd");
    expect(report.contributionMargin.unit).toBe("ratio");
  });
});
