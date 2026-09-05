import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createAssumption } from "./assumption-use-cases";
import { createExperiment, updateExperiment } from "./experiment-use-cases";
import { getExperimentAnalysis } from "./experiment-analysis-use-cases";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("experiment analysis (Phase 7 third slice)", () => {
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
      "experiments",
      "assumptions",
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
      getExperimentAnalysis(db, { actorUserId: bob.user.id, workspaceId: alice.workspace.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("returns an empty-but-valid analysis for a fresh workspace", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const analysis = await getExperimentAnalysis(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
    });

    expect(analysis.totalExperiments).toBe(0);
    expect(analysis.timedExperimentCount).toBe(0);
    expect(analysis.averageCycleTimeDays).toBeNull();
    expect(analysis.totalAssumptions).toBe(0);
    expect(analysis.testedAssumptionCount).toBe(0);
    expect(analysis.untestedAssumptionCount).toBe(0);
    expect(analysis.assumptionCoverage).toEqual([]);
    expect(analysis.experiments).toEqual([]);
  });

  it("computes cycle time and assumption coverage from real records", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const workspaceId = alice.workspace.id;
    const actorUserId = alice.user.id;

    const testedAssumption = await createAssumption(db, {
      workspaceId,
      actorUserId,
      statement: "Customers will pay $50/mo",
      description: "",
      source: "",
      sourceType: "estimate-user",
      confidence: "medium",
      unit: "usd",
      value: 50,
    });
    const untestedAssumption = await createAssumption(db, {
      workspaceId,
      actorUserId,
      statement: "Churn is under 5%",
      description: "",
      source: "",
      sourceType: "estimate-user",
      confidence: "low",
      unit: "%",
      value: 5,
    });

    // A 10-day experiment testing the pricing assumption, adopted. Sets
    // started_at/ended_at directly via the raw client (rather than relying
    // on updateExperiment's "now" timestamps) so the cycle time this test
    // asserts on is deterministic instead of depending on wall-clock time
    // between calls.
    const pricingExperiment = await createExperiment(db, {
      workspaceId,
      actorUserId,
      name: "Pricing test",
      hypothesis: "Customers will pay $50/mo",
      method: "Landing page price test",
      assumptionId: testedAssumption.id,
    });
    await updateExperiment(db, {
      workspaceId,
      actorUserId,
      experimentId: pricingExperiment.id,
      status: "completed",
      decision: "adopt",
    });
    await cleanupClient.query(
      "UPDATE experiments SET started_at = $1, ended_at = $2 WHERE id = $3",
      ["2026-08-01T00:00:00Z", "2026-08-11T00:00:00Z", pricingExperiment.id],
    );

    // A second experiment on the same assumption, still planned (no
    // timing yet) - assumption coverage should still count it.
    await createExperiment(db, {
      workspaceId,
      actorUserId,
      name: "Pricing retest at a lower price",
      hypothesis: "Customers will pay $50/mo",
      method: "Landing page price test v2",
      assumptionId: testedAssumption.id,
    });

    const analysis = await getExperimentAnalysis(db, { actorUserId, workspaceId });

    expect(analysis.totalExperiments).toBe(2);
    expect(analysis.timedExperimentCount).toBe(1);
    expect(analysis.averageCycleTimeDays).toBe(10);
    expect(analysis.decisionCounts.adopt).toBe(1);
    expect(analysis.decisionCounts.reject).toBe(0);

    expect(analysis.totalAssumptions).toBe(2);
    expect(analysis.testedAssumptionCount).toBe(1);
    expect(analysis.untestedAssumptionCount).toBe(1);

    const testedCoverage = analysis.assumptionCoverage.find(
      (a) => a.assumptionId === testedAssumption.id,
    );
    const untestedCoverage = analysis.assumptionCoverage.find(
      (a) => a.assumptionId === untestedAssumption.id,
    );
    expect(testedCoverage?.experimentCount).toBe(2);
    expect(untestedCoverage?.experimentCount).toBe(0);

    const pricingEntry = analysis.experiments.find((e) => e.id === pricingExperiment.id);
    expect(pricingEntry?.cycleTimeDays).toBe(10);
    expect(pricingEntry?.decision).toBe("adopt");
  });
});
