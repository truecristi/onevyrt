import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createOffer, updateOffer } from "./offer-use-cases";
import { createAssumption, updateAssumption } from "./assumption-use-cases";
import { createFunnelStage } from "./funnel-stage-use-cases";
import { createScenario } from "./scenario-use-cases";
import { getFinancialDashboard } from "./financial-dashboard-use-cases";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("financial dashboard (Phase 4 fifth slice)", () => {
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
      "scenarios",
      "funnel_stages",
      "assumptions",
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

  it("rejects a non-member", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");
    const bob = await registerWithWorkspace("bob@example.com", "Bob Co");
    await expect(
      getFinancialDashboard(db, { actorUserId: bob.user.id, workspaceId: alice.workspace.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("returns an empty-but-valid dashboard for a fresh workspace", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const dashboard = await getFinancialDashboard(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
    });
    expect(dashboard.summary).toEqual({
      offerCount: 0,
      activeOfferCount: 0,
      totalActiveOfferValueCents: 0,
      assumptionCount: 0,
      validatedAssumptionCount: 0,
      businessMetricCount: 0,
      funnelStageCount: 0,
      scenarioCount: 0,
    });
    expect(dashboard.offers).toEqual([]);
  });

  it("aggregates real records and derives correct summary counts", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");

    const activeOffer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching package",
      description: "",
      currency: "usd",
      priceCents: 10000,
    });
    await updateOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      offerId: activeOffer.id,
      status: "active",
    });
    await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Draft offer",
      description: "",
      currency: "usd",
      priceCents: 5000,
    }); // stays draft, excluded from active totals

    const assumption = await createAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      statement: "Churn is under 5%",
      description: "",
      source: "",
      sourceType: "estimate-user",
      confidence: "medium",
      unit: "%",
      value: 5,
    });
    await updateAssumption(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      assumptionId: assumption.id,
      status: "validated",
    });

    await createFunnelStage(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Traffic",
      orderIndex: 0,
    });

    await createScenario(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Best case",
      scenarioType: "best",
    });

    const dashboard = await getFinancialDashboard(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
    });

    expect(dashboard.summary).toEqual({
      offerCount: 2,
      activeOfferCount: 1,
      totalActiveOfferValueCents: 10000,
      assumptionCount: 1,
      validatedAssumptionCount: 1,
      businessMetricCount: 0,
      funnelStageCount: 1,
      scenarioCount: 1,
    });
    expect(dashboard.offers).toHaveLength(2);
    expect(dashboard.funnelStages).toHaveLength(1);
    expect(dashboard.scenarios).toHaveLength(1);
  });
});
