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
      DROP TABLE IF EXISTS force_assessments, weekly_reviews, ai_call_records, task_proposals, artifact_proposals, launches, experiments, artifact_versions, funnel_steps, funnel_stages, scenario_assumption_overrides, scenarios, formula_definitions, lesson_applications, lesson_prerequisites, block_responses, notes, bookmarks, lesson_progress, enrollments, lesson_blocks, lessons, program_versions, programs, evidence, decisions, assumptions, business_metrics, tasks, projects, offers, customer_profiles, goals, business_profiles, audit_log, sessions, workspace_members, workspaces, users, schema_migrations CASCADE;
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
      "0010_curriculum_programs.sql",
      "0011_lesson_blocks.sql",
      "0012_progress_tracking.sql",
      "0013_notes_bookmarks.sql",
      "0014_block_responses.sql",
      "0015_lesson_prerequisites.sql",
      "0016_lesson_applications.sql",
      "0017_formula_definitions.sql",
      "0018_scenarios.sql",
      "0019_funnel_stages.sql",
      "0020_assumption_provenance.sql",
      "0021_offer_builder.sql",
      "0022_customer_positioning.sql",
      "0023_funnel_steps.sql",
      "0024_artifact_versions.sql",
      "0025_task_project_system.sql",
      "0026_experiments.sql",
      "0027_evidence_experiment_link.sql",
      "0028_launches.sql",
      "0029_artifact_proposals.sql",
      "0030_task_proposals.sql",
      "0031_ai_call_records.sql",
      "0032_weekly_reviews.sql",
      "0033_force_assessments.sql",
    ]);

    const { rows } = await client.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name != 'schema_migrations'
      ORDER BY table_name;
    `);
    expect(rows.map((row) => row.table_name)).toEqual([
      "ai_call_records",
      "artifact_proposals",
      "artifact_versions",
      "assumptions",
      "audit_log",
      "block_responses",
      "bookmarks",
      "business_metrics",
      "business_profiles",
      "customer_profiles",
      "decisions",
      "enrollments",
      "evidence",
      "experiments",
      "force_assessments",
      "formula_definitions",
      "funnel_stages",
      "funnel_steps",
      "goals",
      "launches",
      "lesson_applications",
      "lesson_blocks",
      "lesson_prerequisites",
      "lesson_progress",
      "lessons",
      "notes",
      "offers",
      "program_versions",
      "programs",
      "projects",
      "scenario_assumption_overrides",
      "scenarios",
      "sessions",
      "task_proposals",
      "tasks",
      "users",
      "weekly_reviews",
      "workspace_members",
      "workspaces",
    ]);
  });

  it("is idempotent - a second run applies nothing", async () => {
    const applied = await runMigrations(TEST_DATABASE_URL);
    expect(applied).toEqual([]);
  });
});
