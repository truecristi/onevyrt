import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type {
  AssumptionConfidence,
  AssumptionSourceType,
  AssumptionStatus,
} from "@onevyrt/contracts";
import { requireWorkspaceMembership, getMembership } from "./workspace-use-cases";
import { AssumptionNotFoundError, AssumptionOwnerNotInWorkspaceError } from "./errors";

/**
 * PRD-BIZCORE-007 vertical slice: assumptions, extended by PRD-NUMBERS-006
 * (Phase 4 sixth slice: assumption provenance, spec section 6.x - "every
 * number carries value, unit, currency, period, source type, source
 * date, confidence, owner and formula trace"). Same tenancy shape as the
 * other business-core use cases - requireWorkspaceMembership
 * (ADR-0003), every write scoped by workspaceId in the WHERE clause.
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
  sourceType: AssumptionSourceType;
  sourceDate: Date | null;
  ownerId: string | null;
  formulaTraceKey: string | null;
  formulaTraceVersion: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** ownerId, if given, must belong to the same workspace - the accountable owner of a number is meaningless if they can't see the workspace it belongs to. */
async function assertOwnerInWorkspace(
  db: Database,
  workspaceId: string,
  ownerId: string,
): Promise<void> {
  const membership = await getMembership(db, workspaceId, ownerId);
  if (!membership) throw new AssumptionOwnerNotInWorkspaceError(ownerId, workspaceId);
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
  sourceType: AssumptionSourceType;
  sourceDate?: string;
  ownerId?: string;
  formulaTraceKey?: string;
  formulaTraceVersion?: number;
}

export async function createAssumption(
  db: Database,
  input: CreateAssumptionInput,
): Promise<AssumptionRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.ownerId !== undefined) {
    await assertOwnerInWorkspace(db, input.workspaceId, input.ownerId);
  }

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
        sourceType: input.sourceType,
        sourceDate: input.sourceDate !== undefined ? new Date(input.sourceDate) : null,
        ownerId: input.ownerId ?? null,
        formulaTraceKey: input.formulaTraceKey ?? null,
        formulaTraceVersion: input.formulaTraceVersion ?? null,
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
  sourceType?: AssumptionSourceType;
  /** undefined = leave unchanged; null = clear it; an ISO string = set it. */
  sourceDate?: string | null;
  /** undefined = leave unchanged; null = clear it; a uuid = set it (validated to belong to this workspace). */
  ownerId?: string | null;
  formulaTraceKey?: string | null;
  formulaTraceVersion?: number | null;
}

/**
 * A partial update, same undefined-vs-null semantics as
 * updateBusinessMetric's value fields: an assumption can genuinely have no
 * numeric value yet (e.g. a qualitative belief with no figure attached),
 * so callers need a way to explicitly clear it, distinct from simply not
 * mentioning it in the patch. The same undefined/null distinction now
 * applies to every provenance field this slice adds.
 */
export async function updateAssumption(
  db: Database,
  input: UpdateAssumptionInput,
): Promise<AssumptionRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.ownerId !== undefined && input.ownerId !== null) {
    await assertOwnerInWorkspace(db, input.workspaceId, input.ownerId);
  }

  return withTransaction(db, async (tx) => {
    const patch: Partial<typeof schema.assumptions.$inferInsert> = { updatedAt: new Date() };
    if (input.statement !== undefined) patch.statement = input.statement;
    if (input.description !== undefined) patch.description = input.description;
    if (input.source !== undefined) patch.source = input.source;
    if (input.confidence !== undefined) patch.confidence = input.confidence;
    if (input.status !== undefined) patch.status = input.status;
    if (input.unit !== undefined) patch.unit = input.unit;
    if (input.value !== undefined) patch.value = input.value;
    if (input.sourceType !== undefined) patch.sourceType = input.sourceType;
    if (input.sourceDate !== undefined) {
      patch.sourceDate = input.sourceDate !== null ? new Date(input.sourceDate) : null;
    }
    if (input.ownerId !== undefined) patch.ownerId = input.ownerId;
    if (input.formulaTraceKey !== undefined) patch.formulaTraceKey = input.formulaTraceKey;
    if (input.formulaTraceVersion !== undefined) {
      patch.formulaTraceVersion = input.formulaTraceVersion;
    }

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
