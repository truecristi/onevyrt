import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { getTestDatabaseUrl } from "@onevyrt/testing";
import { runMigrations } from "./migrate";

// Requires a real Postgres reachable at TEST_DATABASE_URL (defaults to the
// local dev database created for this repo). This is an integration test,
// not a unit test - see §14.1's test pyramid. CI provides this via a
// Postgres service container (.github/workflows/ci.yml).
const TEST_DATABASE_URL = getTestDatabaseUrl();

describe("runMigrations", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    // Start from a clean slate so this test is repeatable. Update this list
    // whenever a new migration adds a table - see the table-name assertion
    // below, which needs the same update.
    await client.query(`
      DROP TABLE IF EXISTS evidence, decisions, assumptions, business_metrics, tasks, offers, customer_profiles, goals, business_profiles, audit_log, sessions, workspace_members, workspaces, users, schema_migrations CASCADE;
    `);
  });

  afterAll(async () => {
    await client.end();
  });

  it("applies every migration and creates the expected tables", async () => {
    const applied = await runMigrations(TEST_DATABASE_URL);
    expect(applied).toEqual([
      "0000_init.sql",
      "0001_business_core.sql",
      "0002_customer_profiles.sql",
      "0003_offers.sql",
      "0004_tasks.sql",
      "0005_business_metrics.sql",
      "0006_assumptions.sql",
      "0007_decisions.sql",
      "0008_evidence.sql",
      "0009_audit_log_workspace_index.sql",
    ]);

    const { rows } = await client.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name != 'schema_migrations'
      ORDER BY table_name;
    `);
    expect(rows.map((row) => row.table_name)).toEqual([
      "assumptions",
      "audit_log",
      "business_metrics",
      "business_profiles",
      "customer_profiles",
      "decisions",
      "evidence",
      "goals",
      "offers",
      "sessions",
      "tasks",
      "users",
      "workspace_members",
      "workspaces",
    ]);
  });

  it("is idempotent - a second run applies nothing", async () => {
    const applied = await runMigrations(TEST_DATABASE_URL);
    expect(applied).toEqual([]);
  });
});
