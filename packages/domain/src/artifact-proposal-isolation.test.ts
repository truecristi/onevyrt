import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createDatabase, runMigrations, type Database } from "@onevyrt/database";
import { getTestDatabaseUrl, truncateTables } from "@onevyrt/testing";
import { registerUser } from "./auth-use-cases";
import { createOffer } from "./offer-use-cases";
import {
  getArtifactForProposal,
  createArtifactProposal,
  listArtifactProposals,
  acceptArtifactProposal,
  rejectArtifactProposal,
} from "./artifact-proposal-use-cases";
import {
  ArtifactNotFoundError,
  ArtifactProposalNotFoundError,
  ArtifactProposalNotPendingError,
  InvalidArtifactProposalPatchError,
} from "./errors";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import type { Pool } from "pg";

const TEST_DATABASE_URL = getTestDatabaseUrl();
const AUTH_SECRET = "b".repeat(64);

describe("artifact proposals (Phase 6 sixth slice)", () => {
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
      "artifact_proposals",
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

  const proposalMeta = {
    rationale: "Sharper value proposition should convert better.",
    promptTemplateKey: "propose_artifact_patch",
    promptTemplateVersion: 1,
    providerId: "deterministic",
    model: "test-model",
  };

  it("gets an artifact's current state for prompt rendering, scoped to the workspace", async () => {
    const alice = await registerWithWorkspace("alice@example.com", "Alice Co");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching program",
      description: "",
      currency: "usd",
    });

    const state = await getArtifactForProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      artifactType: "offer",
      artifactId: offer.id,
    });
    expect(state.name).toBe("Coaching program");
  });

  it("rejects getting an artifact that doesn't exist in the workspace", async () => {
    const alice = await registerWithWorkspace("alice2@example.com", "Alice Co 2");
    await expect(
      getArtifactForProposal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        artifactType: "offer",
        artifactId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(ArtifactNotFoundError);
  });

  it("creates a proposal after validating the patch against the offer's update schema", async () => {
    const alice = await registerWithWorkspace("alice3@example.com", "Alice Co 3");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching program",
      description: "",
      currency: "usd",
    });

    const proposal = await createArtifactProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      artifactType: "offer",
      artifactId: offer.id,
      proposedPatch: { valueProposition: "Go from stuck to $10k/mo in 90 days." },
      ...proposalMeta,
    });

    expect(proposal.status).toBe("pending");
    expect(proposal.proposedPatch).toEqual({
      valueProposition: "Go from stuck to $10k/mo in 90 days.",
    });
    expect(proposal.rationale).toBe(proposalMeta.rationale);

    const list = await listArtifactProposals(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
    });
    expect(list.map((p) => p.id)).toEqual([proposal.id]);
  });

  it("rejects a proposedPatch that doesn't match the artifact type's update schema", async () => {
    const alice = await registerWithWorkspace("alice4@example.com", "Alice Co 4");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching program",
      description: "",
      currency: "usd",
    });

    await expect(
      createArtifactProposal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        artifactType: "offer",
        artifactId: offer.id,
        proposedPatch: { priceCents: "not a number" },
        ...proposalMeta,
      }),
    ).rejects.toThrow(InvalidArtifactProposalPatchError);
  });

  it("applies the patch to the real offer and marks the proposal accepted", async () => {
    const alice = await registerWithWorkspace("alice5@example.com", "Alice Co 5");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching program",
      description: "",
      currency: "usd",
    });
    const proposal = await createArtifactProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      artifactType: "offer",
      artifactId: offer.id,
      proposedPatch: { valueProposition: "Go from stuck to $10k/mo in 90 days." },
      ...proposalMeta,
    });

    const accepted = await acceptArtifactProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      proposalId: proposal.id,
    });
    expect(accepted.status).toBe("accepted");
    expect(accepted.reviewedByUserId).toBe(alice.user.id);
    expect(accepted.reviewedAt).not.toBeNull();

    const updatedOffer = await getArtifactForProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      artifactType: "offer",
      artifactId: offer.id,
    });
    expect(updatedOffer.valueProposition).toBe("Go from stuck to $10k/mo in 90 days.");
  });

  it("marks a proposal rejected without touching the artifact", async () => {
    const alice = await registerWithWorkspace("alice6@example.com", "Alice Co 6");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching program",
      description: "",
      currency: "usd",
    });
    const proposal = await createArtifactProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      artifactType: "offer",
      artifactId: offer.id,
      proposedPatch: { valueProposition: "Should not be applied." },
      ...proposalMeta,
    });

    const rejected = await rejectArtifactProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      proposalId: proposal.id,
    });
    expect(rejected.status).toBe("rejected");

    const untouchedOffer = await getArtifactForProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      artifactType: "offer",
      artifactId: offer.id,
    });
    expect(untouchedOffer.valueProposition).toBe("");
  });

  it("rejects accepting or rejecting a proposal that isn't pending", async () => {
    const alice = await registerWithWorkspace("alice7@example.com", "Alice Co 7");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Coaching program",
      description: "",
      currency: "usd",
    });
    const proposal = await createArtifactProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      artifactType: "offer",
      artifactId: offer.id,
      proposedPatch: {},
      ...proposalMeta,
    });
    await rejectArtifactProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      proposalId: proposal.id,
    });

    await expect(
      acceptArtifactProposal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        proposalId: proposal.id,
      }),
    ).rejects.toThrow(ArtifactProposalNotPendingError);
  });

  it("throws ArtifactProposalNotFoundError for an ID that doesn't exist", async () => {
    const alice = await registerWithWorkspace("alice8@example.com", "Alice Co 8");
    await expect(
      acceptArtifactProposal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: alice.user.id,
        proposalId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(ArtifactProposalNotFoundError);
  });

  it("prevents a user in one workspace from reading or writing another workspace's proposals", async () => {
    const alice = await registerWithWorkspace("alice9@example.com", "Alice Co 9");
    const bob = await registerWithWorkspace("bob9@example.com", "Bob Co 9");
    const offer = await createOffer(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      name: "Alice's offer",
      description: "",
      currency: "usd",
    });
    const proposal = await createArtifactProposal(db, {
      workspaceId: alice.workspace.id,
      actorUserId: alice.user.id,
      artifactType: "offer",
      artifactId: offer.id,
      proposedPatch: {},
      ...proposalMeta,
    });

    await expect(
      listArtifactProposals(db, { workspaceId: alice.workspace.id, actorUserId: bob.user.id }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      createArtifactProposal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        artifactType: "offer",
        artifactId: offer.id,
        proposedPatch: {},
        ...proposalMeta,
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    await expect(
      acceptArtifactProposal(db, {
        workspaceId: alice.workspace.id,
        actorUserId: bob.user.id,
        proposalId: proposal.id,
      }),
    ).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
