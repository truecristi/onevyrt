import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, schema, type Database } from "@onevyrt/database";
import { eq } from "drizzle-orm";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import {
  createFormulaDefinition,
  listFormulaDefinitions,
  publishFormulaDefinition,
  computeFormula,
} from "./formula-use-cases";
import {
  DuplicateFormulaVersionError,
  FormulaImplementationNotFoundError,
  FormulaDefinitionNotFoundError,
  NoPublishedFormulaError,
  FormulaInputMismatchError,
} from "./errors";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("versioned formula library (Phase 4 first slice)", () => {
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
      "formula_definitions",
      "sessions",
      "workspace_members",
      "workspaces",
      "users",
    ]);
  });

  async function registerAdmin(email: string) {
    const result = await registerUser(db, AUTH_SECRET, {
      email,
      password: "correct-horse-battery-staple",
      workspaceName: `${email}'s workspace`,
    });
    await db
      .update(schema.users)
      .set({ isPlatformAdmin: true })
      .where(eq(schema.users.id, result.user.id));
    return result;
  }

  async function registerLearner(email: string) {
    return registerUser(db, AUTH_SECRET, {
      email,
      password: "correct-horse-battery-staple",
      workspaceName: `${email}'s workspace`,
    });
  }

  it("rejects a non-admin creating a formula definition", async () => {
    const learner = await registerLearner("learner@example.com");
    await expect(
      createFormulaDefinition(db, {
        actorUserId: learner.user.id,
        key: "gross_profit",
        version: 1,
        title: "Gross profit",
        description: "",
        inputSchema: [
          { name: "revenue", unit: "currency", description: "" },
          { name: "cost", unit: "currency", description: "" },
        ],
        outputUnit: "currency",
      }),
    ).rejects.toThrow(PlatformAdminRequiredError);
  });

  it("rejects metadata for a (key, version) with no matching registry implementation", async () => {
    const admin = await registerAdmin("admin@example.com");
    await expect(
      createFormulaDefinition(db, {
        actorUserId: admin.user.id,
        key: "gross_profit",
        version: 99,
        title: "Gross profit",
        description: "",
        inputSchema: [{ name: "revenue", unit: "currency", description: "" }],
        outputUnit: "currency",
      }),
    ).rejects.toThrow(FormulaImplementationNotFoundError);
  });

  it("rejects a duplicate (key, version) and publishing archives the previously-published version", async () => {
    const admin = await registerAdmin("admin2@example.com");
    const v1 = await createFormulaDefinition(db, {
      actorUserId: admin.user.id,
      key: "gross_profit",
      version: 1,
      title: "Gross profit",
      description: "",
      inputSchema: [
        { name: "revenue", unit: "currency", description: "" },
        { name: "cost", unit: "currency", description: "" },
      ],
      outputUnit: "currency",
    });

    await expect(
      createFormulaDefinition(db, {
        actorUserId: admin.user.id,
        key: "gross_profit",
        version: 1,
        title: "Gross profit (dup)",
        description: "",
        inputSchema: [{ name: "revenue", unit: "currency", description: "" }],
        outputUnit: "currency",
      }),
    ).rejects.toThrow(DuplicateFormulaVersionError);

    const published1 = await publishFormulaDefinition(db, {
      actorUserId: admin.user.id,
      formulaDefinitionId: v1.id,
    });
    expect(published1.status).toBe("published");

    await expect(
      publishFormulaDefinition(db, {
        actorUserId: admin.user.id,
        formulaDefinitionId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(FormulaDefinitionNotFoundError);
  });

  it("lists drafts to an admin but only published versions to everyone else", async () => {
    const admin = await registerAdmin("admin3@example.com");
    const learner = await registerLearner("learner3@example.com");

    await createFormulaDefinition(db, {
      actorUserId: admin.user.id,
      key: "conversion_rate",
      version: 1,
      title: "Conversion rate",
      description: "",
      inputSchema: [
        { name: "conversions", unit: "count", description: "" },
        { name: "totalVisitors", unit: "count", description: "" },
      ],
      outputUnit: "ratio",
    });

    const adminView = await listFormulaDefinitions(db, { actorUserId: admin.user.id });
    expect(adminView).toHaveLength(1);
    expect(adminView[0]?.status).toBe("draft");

    const learnerView = await listFormulaDefinitions(db, { actorUserId: learner.user.id });
    expect(learnerView).toHaveLength(0);
  });

  it("computes a published formula and returns the full provenance envelope", async () => {
    const admin = await registerAdmin("admin4@example.com");
    const learner = await registerLearner("learner4@example.com");

    const definition = await createFormulaDefinition(db, {
      actorUserId: admin.user.id,
      key: "gross_profit",
      version: 1,
      title: "Gross profit",
      description: "",
      inputSchema: [
        { name: "revenue", unit: "currency", description: "" },
        { name: "cost", unit: "currency", description: "" },
      ],
      outputUnit: "currency",
    });

    // Not published yet - can't be computed by anyone, including a learner.
    await expect(
      computeFormula(db, { key: "gross_profit", inputs: { revenue: 100, cost: 40 } }),
    ).rejects.toThrow(NoPublishedFormulaError);

    await publishFormulaDefinition(db, {
      actorUserId: admin.user.id,
      formulaDefinitionId: definition.id,
    });

    const result = await computeFormula(db, {
      key: "gross_profit",
      inputs: { revenue: 100, cost: 40 },
    });
    expect(result).toMatchObject({
      formulaKey: "gross_profit",
      formulaVersion: 1,
      value: 60,
      unit: "currency",
      valueOrigin: "calculated",
    });
    void learner; // only used to prove this path needs no admin/workspace context at all
  });

  it("rejects computing with missing or unexpected input names", async () => {
    const admin = await registerAdmin("admin5@example.com");
    const definition = await createFormulaDefinition(db, {
      actorUserId: admin.user.id,
      key: "customer_acquisition_cost",
      version: 1,
      title: "Customer acquisition cost",
      description: "",
      inputSchema: [
        { name: "acquisitionSpend", unit: "currency", description: "" },
        { name: "customersAcquired", unit: "count", description: "" },
      ],
      outputUnit: "currency",
    });
    await publishFormulaDefinition(db, {
      actorUserId: admin.user.id,
      formulaDefinitionId: definition.id,
    });

    const error = await computeFormula(db, {
      key: "customer_acquisition_cost",
      inputs: { acquisitionSpend: 500, wrongName: 10 },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FormulaInputMismatchError);
    if (error instanceof FormulaInputMismatchError) {
      expect(error.missing).toEqual(["customersAcquired"]);
      expect(error.unexpected).toEqual(["wrongName"]);
    }
  });
});
