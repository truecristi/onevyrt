import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createOffer, updateOffer } from "./offer-use-cases";
import {
  snapshotArtifactVersion,
  listArtifactVersions,
  compareArtifactVersions,
} from "./artifact-version-use-cases";
import { ArtifactNotFoundError, ArtifactVersionNotFoundError } from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("artifact versioning (Phase 5 fourth slice)", () => {
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
      "artifact_versions",
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

  it("rejects a non-member and a nonexistent artifact", async () => {
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
      snapshotArtifactVersion(db, {
        actorUserId: bob.user.id,
        workspaceId: alice.workspace.id,
        artifactType: "offer",
        artifactId: offer.id,
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      snapshotArtifactVersion(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        artifactType: "offer",
        artifactId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(ArtifactNotFoundError);
  });

  it("snapshots successive versions with auto-incrementing numbers and lists them newest first", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching package",
      description: "",
      currency: "usd",
      priceCents: 10000,
    });

    const v1 = await snapshotArtifactVersion(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      artifactType: "offer",
      artifactId: offer.id,
      changeNote: "Initial version",
    });
    expect(v1.version).toBe(1);
    expect(v1.snapshot.name).toBe("Coaching package");
    expect(v1.snapshot.priceCents).toBe(10000);

    await updateOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      offerId: offer.id,
      priceCents: 15000,
      name: "Premium coaching package",
    });

    const v2 = await snapshotArtifactVersion(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      artifactType: "offer",
      artifactId: offer.id,
      changeNote: "Raised the price and renamed",
    });
    expect(v2.version).toBe(2);
    expect(v2.snapshot.priceCents).toBe(15000);

    const versions = await listArtifactVersions(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      artifactType: "offer",
      artifactId: offer.id,
    });
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
  });

  it("compares two versions and reports only the fields that actually changed", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching package",
      description: "",
      currency: "usd",
      priceCents: 10000,
    });

    await snapshotArtifactVersion(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      artifactType: "offer",
      artifactId: offer.id,
    });

    await updateOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      offerId: offer.id,
      priceCents: 15000,
    });

    await snapshotArtifactVersion(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      artifactType: "offer",
      artifactId: offer.id,
    });

    const comparison = await compareArtifactVersions(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      artifactType: "offer",
      artifactId: offer.id,
      fromVersion: 1,
      toVersion: 2,
    });

    expect(comparison.fromVersion).toBe(1);
    expect(comparison.toVersion).toBe(2);
    const priceChange = comparison.changes.find((c) => c.field === "priceCents");
    expect(priceChange).toEqual({ field: "priceCents", before: 10000, after: 15000 });
    // updatedAt necessarily changed too (it's part of the snapshot), but
    // name/description/currency/status did not - the diff must not report them.
    expect(comparison.changes.some((c) => c.field === "name")).toBe(false);
    expect(comparison.changes.some((c) => c.field === "currency")).toBe(false);

    await expect(
      compareArtifactVersions(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        artifactType: "offer",
        artifactId: offer.id,
        fromVersion: 1,
        toVersion: 99,
      }),
    ).rejects.toThrow(ArtifactVersionNotFoundError);
  });
});
