import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import { isUniqueViolation } from "./db-errors";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import {
  FunnelStepNotFoundError,
  DuplicateFunnelStepOrderError,
  OfferNotFoundError,
} from "./errors";

/**
 * PRD-BUILD-003 vertical slice: the funnel builder (README "Build and
 * execution" -> "Funnel builder", third slice of Phase 5). One ordered
 * funnel map per workspace - same requireWorkspaceMembership tenancy
 * shape as funnel-stage-use-cases.ts, which this deliberately mirrors
 * (create/list/update/delete over an ordered, workspace-owned list) even
 * though the two model different things (see schema.ts's funnelSteps
 * doc comment).
 */

export interface FunnelStepRecord {
  id: string;
  workspaceId: string;
  name: string;
  stepType: string;
  orderIndex: number;
  offerId: string | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

/** offerId, if given, must belong to the same workspace - the same cross-entity link-integrity check used throughout this codebase (e.g. lesson-application-use-cases.ts's assertResourceInWorkspace). */
async function assertOfferInWorkspace(
  db: Database,
  workspaceId: string,
  offerId: string,
): Promise<void> {
  const offer = await db.query.offers.findFirst({
    where: and(eq(schema.offers.id, offerId), eq(schema.offers.workspaceId, workspaceId)),
  });
  if (!offer) throw new OfferNotFoundError(offerId);
}

export interface CreateFunnelStepInput {
  actorUserId: string;
  workspaceId: string;
  name: string;
  stepType: string;
  orderIndex: number;
  offerId?: string;
  notes?: string;
}

export async function createFunnelStep(
  db: Database,
  input: CreateFunnelStepInput,
): Promise<FunnelStepRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.offerId !== undefined) {
    await assertOfferInWorkspace(db, input.workspaceId, input.offerId);
  }

  try {
    const [step] = await db
      .insert(schema.funnelSteps)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        stepType: input.stepType,
        orderIndex: input.orderIndex,
        offerId: input.offerId ?? null,
        notes: input.notes ?? "",
      })
      .returning();
    if (!step) throw new Error("Failed to create funnel step");
    return step as FunnelStepRecord;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateFunnelStepOrderError(input.workspaceId, input.orderIndex);
    }
    throw error;
  }
}

export interface ListFunnelStepsInput {
  actorUserId: string;
  workspaceId: string;
}

export async function listFunnelSteps(
  db: Database,
  input: ListFunnelStepsInput,
): Promise<FunnelStepRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.funnelSteps)
    .where(eq(schema.funnelSteps.workspaceId, input.workspaceId))
    .orderBy(asc(schema.funnelSteps.orderIndex));

  return rows as FunnelStepRecord[];
}

export interface UpdateFunnelStepInput {
  actorUserId: string;
  workspaceId: string;
  funnelStepId: string;
  name?: string;
  stepType?: string;
  orderIndex?: number;
  /** undefined = leave unchanged; null = unlink the offer; a uuid = set it. */
  offerId?: string | null;
  notes?: string;
}

export async function updateFunnelStep(
  db: Database,
  input: UpdateFunnelStepInput,
): Promise<FunnelStepRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.offerId !== undefined && input.offerId !== null) {
    await assertOfferInWorkspace(db, input.workspaceId, input.offerId);
  }

  const patch: Partial<typeof schema.funnelSteps.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.stepType !== undefined) patch.stepType = input.stepType;
  if (input.orderIndex !== undefined) patch.orderIndex = input.orderIndex;
  if (input.offerId !== undefined) patch.offerId = input.offerId;
  if (input.notes !== undefined) patch.notes = input.notes;

  try {
    const [step] = await db
      .update(schema.funnelSteps)
      .set(patch)
      .where(
        and(
          eq(schema.funnelSteps.id, input.funnelStepId),
          eq(schema.funnelSteps.workspaceId, input.workspaceId),
        ),
      )
      .returning();
    if (!step) throw new FunnelStepNotFoundError(input.funnelStepId);
    return step as FunnelStepRecord;
  } catch (error) {
    if (isUniqueViolation(error) && input.orderIndex !== undefined) {
      throw new DuplicateFunnelStepOrderError(input.workspaceId, input.orderIndex);
    }
    throw error;
  }
}

export interface DeleteFunnelStepInput {
  actorUserId: string;
  workspaceId: string;
  funnelStepId: string;
}

/** A hard delete, same accepted exception as funnel_stages/notes/bookmarks: a funnel map is a structural list a user actively edits (add/remove/reorder steps), not a record with a meaningful status history. */
export async function deleteFunnelStep(db: Database, input: DeleteFunnelStepInput): Promise<void> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const [deleted] = await db
    .delete(schema.funnelSteps)
    .where(
      and(
        eq(schema.funnelSteps.id, input.funnelStepId),
        eq(schema.funnelSteps.workspaceId, input.workspaceId),
      ),
    )
    .returning();
  if (!deleted) throw new FunnelStepNotFoundError(input.funnelStepId);
}
