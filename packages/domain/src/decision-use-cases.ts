import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { DecisionStatus } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { DecisionNotFoundError } from "./errors";

/**
 * PRD-BIZCORE-008 vertical slice: decisions. Same tenancy shape as the
 * other business-core use cases - requireWorkspaceMembership (ADR-0003),
 * every write scoped by workspaceId in the WHERE clause.
 */

export interface DecisionRecord {
  id: string;
  workspaceId: string;
  title: string;
  context: string;
  outcome: string;
  status: DecisionStatus;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDecisionInput {
  workspaceId: string;
  actorUserId: string;
  title: string;
  context: string;
  outcome: string;
}

export async function createDecision(
  db: Database,
  input: CreateDecisionInput,
): Promise<DecisionRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const [decision] = await tx
      .insert(schema.decisions)
      .values({
        workspaceId: input.workspaceId,
        title: input.title,
        context: input.context,
        outcome: input.outcome,
      })
      .returning();
    if (!decision) throw new Error("Failed to create decision");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "decision.created",
      metadata: { title: decision.title },
    });

    return decision as DecisionRecord;
  });
}

export interface ListDecisionsInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listDecisions(
  db: Database,
  input: ListDecisionsInput,
): Promise<DecisionRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.decisions)
    .where(eq(schema.decisions.workspaceId, input.workspaceId))
    .orderBy(desc(schema.decisions.createdAt));

  return rows as DecisionRecord[];
}

export interface UpdateDecisionInput {
  workspaceId: string;
  actorUserId: string;
  decisionId: string;
  title?: string;
  context?: string;
  outcome?: string;
  status?: DecisionStatus;
}

/**
 * A partial update. When status is included, decidedAt is derived from it
 * (set for "decided", cleared otherwise) rather than accepted as a
 * separate input - see the schema.ts doc comment on decisions.decidedAt
 * for why "reversed" clears it rather than preserving history.
 */
export async function updateDecision(
  db: Database,
  input: UpdateDecisionInput,
): Promise<DecisionRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const patch: Partial<typeof schema.decisions.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.context !== undefined) patch.context = input.context;
    if (input.outcome !== undefined) patch.outcome = input.outcome;
    if (input.status !== undefined) {
      patch.status = input.status;
      patch.decidedAt = input.status === "decided" ? new Date() : null;
    }

    const [decision] = await tx
      .update(schema.decisions)
      .set(patch)
      .where(
        and(
          eq(schema.decisions.id, input.decisionId),
          eq(schema.decisions.workspaceId, input.workspaceId),
        ),
      )
      .returning();

    if (!decision) throw new DecisionNotFoundError(input.decisionId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "decision.updated",
      metadata: { decisionId: decision.id, status: decision.status },
    });

    return decision as DecisionRecord;
  });
}
