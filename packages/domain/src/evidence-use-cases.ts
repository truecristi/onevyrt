import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { EvidenceStrength } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { AssumptionNotFoundError, DecisionNotFoundError, EvidenceNotFoundError } from "./errors";

/**
 * PRD-BIZCORE-009 vertical slice: evidence. Same tenancy shape as the
 * other business-core use cases - requireWorkspaceMembership (ADR-0003),
 * every write scoped by workspaceId in the WHERE clause - plus a second
 * check this slice adds: an assumptionId/decisionId link is only allowed
 * when that record exists *in the same workspace*, checked explicitly
 * here because the database foreign key alone can't express that (see the
 * doc comment on schema.ts's evidence table).
 */

export interface EvidenceRecord {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  sourceUrl: string;
  strength: EvidenceStrength;
  assumptionId: string | null;
  decisionId: string | null;
  collectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

async function assertAssumptionInWorkspace(
  db: Database,
  workspaceId: string,
  assumptionId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: schema.assumptions.id })
    .from(schema.assumptions)
    .where(
      and(eq(schema.assumptions.id, assumptionId), eq(schema.assumptions.workspaceId, workspaceId)),
    );
  if (!row) throw new AssumptionNotFoundError(assumptionId);
}

async function assertDecisionInWorkspace(
  db: Database,
  workspaceId: string,
  decisionId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: schema.decisions.id })
    .from(schema.decisions)
    .where(and(eq(schema.decisions.id, decisionId), eq(schema.decisions.workspaceId, workspaceId)));
  if (!row) throw new DecisionNotFoundError(decisionId);
}

export interface CreateEvidenceInput {
  workspaceId: string;
  actorUserId: string;
  title: string;
  description: string;
  sourceUrl: string;
  strength: EvidenceStrength;
  assumptionId?: string;
  decisionId?: string;
  collectedAt?: Date;
}

export async function createEvidence(
  db: Database,
  input: CreateEvidenceInput,
): Promise<EvidenceRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.assumptionId !== undefined) {
    await assertAssumptionInWorkspace(db, input.workspaceId, input.assumptionId);
  }
  if (input.decisionId !== undefined) {
    await assertDecisionInWorkspace(db, input.workspaceId, input.decisionId);
  }

  return withTransaction(db, async (tx) => {
    const [item] = await tx
      .insert(schema.evidence)
      .values({
        workspaceId: input.workspaceId,
        title: input.title,
        description: input.description,
        sourceUrl: input.sourceUrl,
        strength: input.strength,
        assumptionId: input.assumptionId ?? null,
        decisionId: input.decisionId ?? null,
        collectedAt: input.collectedAt ?? null,
      })
      .returning();
    if (!item) throw new Error("Failed to create evidence");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "evidence.created",
      metadata: { title: item.title },
    });

    return item as EvidenceRecord;
  });
}

export interface ListEvidenceInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listEvidence(
  db: Database,
  input: ListEvidenceInput,
): Promise<EvidenceRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.evidence)
    .where(eq(schema.evidence.workspaceId, input.workspaceId))
    .orderBy(desc(schema.evidence.createdAt));

  return rows as EvidenceRecord[];
}

export interface UpdateEvidenceInput {
  workspaceId: string;
  actorUserId: string;
  evidenceId: string;
  title?: string;
  description?: string;
  sourceUrl?: string;
  strength?: EvidenceStrength;
  /** undefined = leave unchanged; null = detach; a uuid = attach (validated to be in this workspace). */
  assumptionId?: string | null;
  decisionId?: string | null;
  collectedAt?: Date | null;
}

export async function updateEvidence(
  db: Database,
  input: UpdateEvidenceInput,
): Promise<EvidenceRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.assumptionId !== undefined && input.assumptionId !== null) {
    await assertAssumptionInWorkspace(db, input.workspaceId, input.assumptionId);
  }
  if (input.decisionId !== undefined && input.decisionId !== null) {
    await assertDecisionInWorkspace(db, input.workspaceId, input.decisionId);
  }

  return withTransaction(db, async (tx) => {
    const patch: Partial<typeof schema.evidence.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.sourceUrl !== undefined) patch.sourceUrl = input.sourceUrl;
    if (input.strength !== undefined) patch.strength = input.strength;
    if (input.assumptionId !== undefined) patch.assumptionId = input.assumptionId;
    if (input.decisionId !== undefined) patch.decisionId = input.decisionId;
    if (input.collectedAt !== undefined) patch.collectedAt = input.collectedAt;

    const [item] = await tx
      .update(schema.evidence)
      .set(patch)
      .where(
        and(
          eq(schema.evidence.id, input.evidenceId),
          eq(schema.evidence.workspaceId, input.workspaceId),
        ),
      )
      .returning();

    if (!item) throw new EvidenceNotFoundError(input.evidenceId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "evidence.updated",
      metadata: { evidenceId: item.id },
    });

    return item as EvidenceRecord;
  });
}
