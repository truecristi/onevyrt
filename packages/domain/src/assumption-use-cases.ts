import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { AssumptionConfidence, AssumptionStatus } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { AssumptionNotFoundError } from "./errors";

/**
 * PRD-BIZCORE-007 vertical slice: assumptions. Same tenancy shape as the
 * other business-core use cases - requireWorkspaceMembership (ADR-0003),
 * every write scoped by workspaceId in the WHERE clause.
 */

export interface AssumptionRecord {
  id: string;
  workspaceId: string;
  statement: string;
  description: string;
  source: string;
  confidence: AssumptionConfidence;
  status: AssumptionStatus;
  unit: string;
  value: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAssumptionInput {
  workspaceId: string;
  actorUserId: string;
  statement: string;
  description: string;
  source: string;
  confidence: AssumptionConfidence;
  unit: string;
  value?: number;
}

export async function createAssumption(
  db: Database,
  input: CreateAssumptionInput,
): Promise<AssumptionRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const [assumption] = await tx
      .insert(schema.assumptions)
      .values({
        workspaceId: input.workspaceId,
        statement: input.statement,
        description: input.description,
        source: input.source,
        confidence: input.confidence,
        unit: input.unit,
        value: input.value ?? null,
      })
      .returning();
    if (!assumption) throw new Error("Failed to create assumption");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "assumption.created",
      metadata: { statement: assumption.statement },
    });

    return assumption as AssumptionRecord;
  });
}

export interface ListAssumptionsInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listAssumptions(
  db: Database,
  input: ListAssumptionsInput,
): Promise<AssumptionRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.assumptions)
    .where(eq(schema.assumptions.workspaceId, input.workspaceId))
    .orderBy(desc(schema.assumptions.createdAt));

  return rows as AssumptionRecord[];
}

export interface UpdateAssumptionInput {
  workspaceId: string;
  actorUserId: string;
  assumptionId: string;
  statement?: string;
  description?: string;
  source?: string;
  confidence?: AssumptionConfidence;
  status?: AssumptionStatus;
  unit?: string;
  /** undefined = leave unchanged; null = clear the value; a number = set it. */
  value?: number | null;
}

/**
 * A partial update, same undefined-vs-null semantics as
 * updateBusinessMetric's value fields: an assumption can genuinely have no
 * numeric value yet (e.g. a qualitative belief with no figure attached),
 * so callers need a way to explicitly clear it, distinct from simply not
 * mentioning it in the patch.
 */
export async function updateAssumption(
  db: Database,
  input: UpdateAssumptionInput,
): Promise<AssumptionRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const patch: Partial<typeof schema.assumptions.$inferInsert> = { updatedAt: new Date() };
    if (input.statement !== undefined) patch.statement = input.statement;
    if (input.description !== undefined) patch.description = input.description;
    if (input.source !== undefined) patch.source = input.source;
    if (input.confidence !== undefined) patch.confidence = input.confidence;
    if (input.status !== undefined) patch.status = input.status;
    if (input.unit !== undefined) patch.unit = input.unit;
    if (input.value !== undefined) patch.value = input.value;

    const [assumption] = await tx
      .update(schema.assumptions)
      .set(patch)
      .where(
        and(
          eq(schema.assumptions.id, input.assumptionId),
          eq(schema.assumptions.workspaceId, input.workspaceId),
        ),
      )
      .returning();

    if (!assumption) throw new AssumptionNotFoundError(input.assumptionId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "assumption.updated",
      metadata: { assumptionId: assumption.id, status: assumption.status },
    });

    return assumption as AssumptionRecord;
  });
}
