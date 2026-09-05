import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createOffer } from "./offer-use-cases";
import {
  createFunnelStep,
  listFunnelSteps,
  updateFunnelStep,
  deleteFunnelStep,
} from "./funnel-step-use-cases";
import {
  DuplicateFunnelStepOrderError,
  FunnelStepNotFoundError,
  OfferNotFoundError,
} from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("funnel builder (Phase 5 third slice)", () => {
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
      "funnel_steps",
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

  it("rejects a non-member creating a funnel step", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");
    const bob = await registerWithWorkspace("bob@example.com", "Bob Co");
    await expect(
      createFunnelStep(db, {
        actorUserId: bob.user.id,
        workspaceId: alice.workspace.id,
        name: "Landing page",
        stepType: "landing-page",
        orderIndex: 0,
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });

  it("rejects a duplicate step position, links a step to a real offer, and rejects an offer from a different workspace", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    const bob = await registerWithWorkspace("bob2@example.com", "Bob Co 2");

    const alicesOffer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching package",
      description: "",
      currency: "usd",
      priceCents: 10000,
    });
    const bobsOffer = await createOffer(db, {
      workspaceId: bob.workspace.id,
      actorUserId: bob.user.id,
      name: "Bob's offer",
      description: "",
      currency: "usd",
    });

    const landingPage = await createFunnelStep(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Landing page",
      stepType: "landing-page",
      orderIndex: 0,
    });

    await expect(
      createFunnelStep(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        name: "Duplicate position",
        stepType: "opt-in",
        orderIndex: 0,
      }),
    ).rejects.toThrow(DuplicateFunnelStepOrderError);

    const salesPage = await createFunnelStep(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Sales page",
      stepType: "sales-page",
      orderIndex: 1,
      offerId: alicesOffer.id,
    });
    expect(salesPage.offerId).toBe(alicesOffer.id);

    await expect(
      createFunnelStep(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        name: "Should fail",
        stepType: "checkout",
        orderIndex: 2,
        offerId: bobsOffer.id,
      }),
    ).rejects.toThrow(OfferNotFoundError);

    const steps = await listFunnelSteps(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
    });
    expect(steps.map((s) => s.id)).toEqual([landingPage.id, salesPage.id]);
  });

  it("updates and deletes a funnel step, including unlinking an offer", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching package",
      description: "",
      currency: "usd",
    });

    const step = await createFunnelStep(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      name: "Sales page",
      stepType: "sales-page",
      orderIndex: 0,
      offerId: offer.id,
    });

    const renamed = await updateFunnelStep(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      funnelStepId: step.id,
      name: "Main sales page",
    });
    expect(renamed.name).toBe("Main sales page");
    expect(renamed.offerId).toBe(offer.id); // untouched by this update

    const unlinked = await updateFunnelStep(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      funnelStepId: step.id,
      offerId: null,
    });
    expect(unlinked.offerId).toBeNull();

    await deleteFunnelStep(db, {
      actorUserId: alice.user.id,
      workspaceId: alice.workspace.id,
      funnelStepId: step.id,
    });

    await expect(
      deleteFunnelStep(db, {
        actorUserId: alice.user.id,
        workspaceId: alice.workspace.id,
        funnelStepId: step.id,
      }),
    ).rejects.toThrow(FunnelStepNotFoundError);
  });
});
