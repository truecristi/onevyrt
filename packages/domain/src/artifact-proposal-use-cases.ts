import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import {
  updateOfferRequestSchema,
  updateCustomerProfileRequestSchema,
  updateFunnelStepRequestSchema,
} from "@onevyrt/contracts";
import type { ArtifactProposalStatus, ArtifactType } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { updateOffer } from "./offer-use-cases";
import { updateCustomerProfile } from "./customer-profile-use-cases";
import { updateFunnelStep } from "./funnel-step-use-cases";
import {
  ArtifactNotFoundError,
  ArtifactProposalNotFoundError,
  ArtifactProposalNotPendingError,
  InvalidArtifactProposalPatchError,
} from "./errors";

/**
 * PRD-AI-006 vertical slice: artifact proposals (README "AI coaching" ->
 * "Artifact proposals", sixth slice of Phase 6; ADR-0012, spec §7.2's
 * "propose -> validate -> user-review -> accept/edit/reject -> audited-
 * apply" pipeline). See schema.ts's artifactProposals doc comment for why
 * this covers the same three artifact types as artifact versioning
 * rather than a fourth polymorphic surface.
 *
 * This file only handles storage, validation and applying an accepted
 * patch - actually calling a model to produce a proposedPatch (packages/
 * ai's gateway/prompt registry) happens at the API route, the one place
 * allowed to know about both packages/domain and packages/ai (the same
 * layering the coaching interface and lesson explanations routes
 * already use).
 */

export interface ArtifactProposalRecord {
  id: string;
  workspaceId: string;
  artifactType: ArtifactType;
  artifactId: string;
  proposedPatch: Record<string, unknown>;
  rationale: string;
  promptTemplateKey: string;
  promptTemplateVersion: number;
  providerId: string;
  model: string;
  status: ArtifactProposalStatus;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Fetches the artifact's current row and confirms it belongs to this workspace - same cross-entity link-integrity check as artifact-version-use-cases.ts's loadArtifactInWorkspace, over the same three artifact types. */
async function loadArtifactInWorkspace(
  db: Database,
  artifactType: ArtifactType,
  artifactId: string,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  let row: Record<string, unknown> | undefined;

  switch (artifactType) {
    case "offer":
      row = await db.query.offers.findFirst({
        where: and(eq(schema.offers.id, artifactId), eq(schema.offers.workspaceId, workspaceId)),
      });
      break;
    case "customer_profile":
      row = await db.query.customerProfiles.findFirst({
        where: and(
          eq(schema.customerProfiles.id, artifactId),
          eq(schema.customerProfiles.workspaceId, workspaceId),
        ),
      });
      break;
    case "funnel_step":
      row = await db.query.funnelSteps.findFirst({
        where: and(
          eq(schema.funnelSteps.id, artifactId),
          eq(schema.funnelSteps.workspaceId, workspaceId),
        ),
      });
      break;
  }

  if (!row) throw new ArtifactNotFoundError(artifactType, artifactId);
  return row;
}

/** The AI-facing use case's response almost always uses a subset of an artifact's own update-request contract - reusing it here is the "server validates" half of §7.2's safe operation protocol, without inventing a parallel schema per artifact type. */
function validateProposedPatch(
  artifactType: ArtifactType,
  patch: unknown,
): Record<string, unknown> {
  const schema =
    artifactType === "offer"
      ? updateOfferRequestSchema
      : artifactType === "customer_profile"
        ? updateCustomerProfileRequestSchema
        : updateFunnelStepRequestSchema;

  const result = schema.safeParse(patch);
  if (!result.success) {
    throw new InvalidArtifactProposalPatchError(artifactType, result.error.message);
  }
  return result.data;
}

export interface GetArtifactForProposalInput {
  workspaceId: string;
  actorUserId: string;
  artifactType: ArtifactType;
  artifactId: string;
}

/** Fetches an artifact's current state for the API route to render into a prompt - the route needs this to ask the model to propose changes to something, but should never query offers/customerProfiles/funnelSteps directly itself. */
export async function getArtifactForProposal(
  db: Database,
  input: GetArtifactForProposalInput,
): Promise<Record<string, unknown>> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  return loadArtifactInWorkspace(db, input.artifactType, input.artifactId, input.workspaceId);
}

export interface CreateArtifactProposalInput {
  workspaceId: string;
  actorUserId: string;
  artifactType: ArtifactType;
  artifactId: string;
  proposedPatch: unknown;
  rationale: string;
  promptTemplateKey: string;
  promptTemplateVersion: number;
  providerId: string;
  model: string;
}

export async function createArtifactProposal(
  db: Database,
  input: CreateArtifactProposalInput,
): Promise<ArtifactProposalRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  await loadArtifactInWorkspace(db, input.artifactType, input.artifactId, input.workspaceId);
  const proposedPatch = validateProposedPatch(input.artifactType, input.proposedPatch);

  return withTransaction(db, async (tx) => {
    const [proposal] = await tx
      .insert(schema.artifactProposals)
      .values({
        workspaceId: input.workspaceId,
        artifactType: input.artifactType,
        artifactId: input.artifactId,
        proposedPatch,
        rationale: input.rationale,
        promptTemplateKey: input.promptTemplateKey,
        promptTemplateVersion: input.promptTemplateVersion,
        providerId: input.providerId,
        model: input.model,
      })
      .returning();
    if (!proposal) throw new Error("Failed to create artifact proposal");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "artifact_proposal.created",
      metadata: { artifactType: proposal.artifactType, artifactId: proposal.artifactId },
    });

    return proposal as ArtifactProposalRecord;
  });
}

export interface ListArtifactProposalsInput {
  workspaceId: string;
  actorUserId: string;
  artifactType?: ArtifactType;
  artifactId?: string;
}

export async function listArtifactProposals(
  db: Database,
  input: ListArtifactProposalsInput,
): Promise<ArtifactProposalRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const conditions = [eq(schema.artifactProposals.workspaceId, input.workspaceId)];
  if (input.artifactType !== undefined) {
    conditions.push(eq(schema.artifactProposals.artifactType, input.artifactType));
  }
  if (input.artifactId !== undefined) {
    conditions.push(eq(schema.artifactProposals.artifactId, input.artifactId));
  }

  const rows = await db
    .select()
    .from(schema.artifactProposals)
    .where(and(...conditions))
    .orderBy(desc(schema.artifactProposals.createdAt));

  return rows as ArtifactProposalRecord[];
}

async function getPendingProposalOrThrow(db: Database, workspaceId: string, proposalId: string) {
  const proposal = await db.query.artifactProposals.findFirst({
    where: and(
      eq(schema.artifactProposals.id, proposalId),
      eq(schema.artifactProposals.workspaceId, workspaceId),
    ),
  });
  if (!proposal) throw new ArtifactProposalNotFoundError(proposalId);
  if (proposal.status !== "pending") {
    throw new ArtifactProposalNotPendingError(proposalId, proposal.status);
  }
  return proposal;
}

export interface AcceptArtifactProposalInput {
  workspaceId: string;
  actorUserId: string;
  proposalId: string;
}

/**
 * The "audited-apply" half of §7.2's pipeline: applies the (already-
 * validated, at creation time) proposedPatch to the real artifact through
 * that artifact type's own update use case - the same domain function
 * and "<artifact>.updated" audit-log entry a human editing the same
 * field through the regular PATCH route would produce - then separately
 * marks the proposal accepted and records that write.
 *
 * These are two separate top-level transactions, not one: updateOffer/
 * updateCustomerProfile/updateFunnelStep each already open their own
 * (they're ordinary domain use cases, called exactly as the PATCH routes
 * call them - not reimplemented here), and this codebase has no nested-
 * transaction composition for calling one domain use case from inside
 * another's transaction. The patch application runs first as the source
 * of truth; if marking the proposal accepted afterward fails, the
 * proposal stays "pending" and a retry is safe - re-applying the same
 * validated field values is idempotent, never a different result.
 */
export async function acceptArtifactProposal(
  db: Database,
  input: AcceptArtifactProposalInput,
): Promise<ArtifactProposalRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  const proposal = await getPendingProposalOrThrow(db, input.workspaceId, input.proposalId);
  const patch = proposal.proposedPatch as Record<string, unknown>;

  if (proposal.artifactType === "offer") {
    await updateOffer(db, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      offerId: proposal.artifactId,
      ...patch,
    });
  } else if (proposal.artifactType === "customer_profile") {
    await updateCustomerProfile(db, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      customerProfileId: proposal.artifactId,
      ...patch,
    });
  } else {
    await updateFunnelStep(db, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      funnelStepId: proposal.artifactId,
      ...patch,
    });
  }

  return withTransaction(db, async (tx) => {
    const [updated] = await tx
      .update(schema.artifactProposals)
      .set({
        status: "accepted",
        reviewedByUserId: input.actorUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.artifactProposals.id, proposal.id))
      .returning();
    if (!updated) throw new ArtifactProposalNotFoundError(input.proposalId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "artifact_proposal.accepted",
      metadata: { artifactType: updated.artifactType, artifactId: updated.artifactId },
    });

    return updated as ArtifactProposalRecord;
  });
}

export interface RejectArtifactProposalInput {
  workspaceId: string;
  actorUserId: string;
  proposalId: string;
}

export async function rejectArtifactProposal(
  db: Database,
  input: RejectArtifactProposalInput,
): Promise<ArtifactProposalRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  const proposal = await getPendingProposalOrThrow(db, input.workspaceId, input.proposalId);

  return withTransaction(db, async (tx) => {
    const [updated] = await tx
      .update(schema.artifactProposals)
      .set({
        status: "rejected",
        reviewedByUserId: input.actorUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.artifactProposals.id, proposal.id))
      .returning();
    if (!updated) throw new ArtifactProposalNotFoundError(input.proposalId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "artifact_proposal.rejected",
      metadata: { artifactType: updated.artifactType, artifactId: updated.artifactId },
    });

    return updated as ArtifactProposalRecord;
  });
}
