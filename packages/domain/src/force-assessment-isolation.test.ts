import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import {
  FORCES,
  getConstraintDiagnosis,
  listForceAssessments,
  upsertForceAssessment,
} from "./force-assessment-use-cases";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("force assessments and constraint diagnosis (Phase 7 fourth slice)", () => {
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
      "force_assessments",
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

  it("rejects a non-member for every operation", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");
    const bob = await registerWithWorkspace("bob@example.com", "Bob Co");

    await expect(
      upsertForceAssessment(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        force: "sales_marketing",
        score: 40,
        confidence: "medium",
        evidence: "",
        constraintNote: "",
        recommendations: "",
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      listForceAssessments(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      getConstraintDiagnosis(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("reports every force as unassessed with no primary constraint for a fresh workspace", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const diagnosis = await getConstraintDiagnosis(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
    });

    expect(diagnosis.forces).toHaveLength(FORCES.length);
    expect(diagnosis.forces.every((f) => f.assessed === false)).toBe(true);
    expect(diagnosis.rankedAssessedForces).toEqual([]);
    expect(diagnosis.primaryConstraint).toBeNull();
    expect(diagnosis.unassessedForceCount).toBe(FORCES.length);
  });

  it("upserts one assessment per force and identifies the weakest assessed force as the primary constraint", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const workspaceId = alice.workspace.id;
    const actorUserId = alice.user.id;

    await upsertForceAssessment(db, {
      workspaceId,
      actorUserId,
      force: "sales_marketing",
      score: 30,
      target: 70,
      confidence: "high",
      evidence: "No consistent lead source",
      constraintNote: "No repeatable way to generate leads",
      recommendations: "Pick one channel and run it for 90 days",
    });
    await upsertForceAssessment(db, {
      workspaceId,
      actorUserId,
      force: "operations_systems",
      score: 65,
      target: 80,
      confidence: "medium",
      evidence: "",
      constraintNote: "",
      recommendations: "",
    });
    // finance_measurement has a lower target-gap (90-80=10) than
    // sales_marketing's (70-30=40), but a *higher* score (80 > 30) - the
    // primary constraint must still be sales_marketing, since this picks
    // the lowest score, never the widest gap-to-target.
    await upsertForceAssessment(db, {
      workspaceId,
      actorUserId,
      force: "finance_measurement",
      score: 80,
      target: 90,
      confidence: "low",
      evidence: "",
      constraintNote: "",
      recommendations: "",
    });

    const all = await listForceAssessments(db, { workspaceId, actorUserId });
    expect(all).toHaveLength(3);

    const diagnosis = await getConstraintDiagnosis(db, { actorUserId, workspaceId });
    expect(diagnosis.unassessedForceCount).toBe(FORCES.length - 3);
    expect(diagnosis.rankedAssessedForces.map((f) => f.force)).toEqual([
      "sales_marketing",
      "operations_systems",
      "finance_measurement",
    ]);
    expect(diagnosis.primaryConstraint?.force).toBe("sales_marketing");
    expect(diagnosis.primaryConstraint?.score).toBe(30);
    expect(diagnosis.primaryConstraint?.gapToTarget).toBe(40);

    // Re-saving the same force updates the existing row rather than
    // creating a second one for that force. Raising sales_marketing's
    // score above operations_systems's (65) should shift the primary
    // constraint to whichever force is now weakest.
    await upsertForceAssessment(db, {
      workspaceId,
      actorUserId,
      force: "sales_marketing",
      score: 75,
      target: 70,
      confidence: "high",
      evidence: "Found a repeatable channel",
      constraintNote: "",
      recommendations: "",
    });
    const afterRevision = await listForceAssessments(db, { workspaceId, actorUserId });
    expect(afterRevision).toHaveLength(3);

    const diagnosisAfterRevision = await getConstraintDiagnosis(db, { actorUserId, workspaceId });
    expect(diagnosisAfterRevision.primaryConstraint?.force).toBe("operations_systems");
  });
});
