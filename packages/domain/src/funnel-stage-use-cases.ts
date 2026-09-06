import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import type { FunnelStageRequirement } from "@onevyrt/contracts";
import { isUniqueViolation } from "./db-errors";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import {
  FunnelStageNotFoundError,
  DuplicateFunnelStageOrderError,
  FunnelHasNoStagesError,
  MissingConversionRateError,
} from "./errors";

/**
 * PRD-NUMBERS-003 vertical slice: funnel mathematics (README "Numbers
 * and modeling" -> "Funnel mathematics", third slice of Phase 4). One
 * ordered funnel per workspace - same requireWorkspaceMembership tenancy
 * shape as assumption/scenario-use-cases.ts.
 */

export interface FunnelStageRecord {
  id: string;
  workspaceId: string;
  name: string;
  orderIndex: number;
  conversionRate: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFunnelStageInput {
  actorUserId: string;
  workspaceId: string;
  name: string;
  orderIndex: number;
  conversionRate?: number;
}

export async function createFunnelStage(
  db: Database,
  input: CreateFunnelStageInput,
): Promise<FunnelStageRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  try {
    const [stage] = await db
      .insert(schema.funnelStages)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        orderIndex: input.orderIndex,
        conversionRate: input.conversionRate ?? null,
      })
      .returning();
    if (!stage) throw new Error("Failed to create funnel stage");
    return stage as FunnelStageRecord;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateFunnelStageOrderError(input.workspaceId, input.orderIndex);
    }
    throw error;
  }
}

export interface ListFunnelStagesInput {
  actorUserId: string;
  workspaceId: string;
}

export async function listFunnelStages(
  db: Database,
  input: ListFunnelStagesInput,
): Promise<FunnelStageRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.funnelStages)
    .where(eq(schema.funnelStages.workspaceId, input.workspaceId))
    .orderBy(asc(schema.funnelStages.orderIndex));

  return rows as FunnelStageRecord[];
}

export interface UpdateFunnelStageInput {
  actorUserId: string;
  workspaceId: string;
  funnelStageId: string;
  name?: string;
  orderIndex?: number;
  /** undefined = leave unchanged; null = clear it; a number = set it. */
  conversionRate?: number | null;
}

export async function updateFunnelStage(
  db: Database,
  input: UpdateFunnelStageInput,
): Promise<FunnelStageRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const patch: Partial<typeof schema.funnelStages.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.orderIndex !== undefined) patch.orderIndex = input.orderIndex;
  if (input.conversionRate !== undefined) patch.conversionRate = input.conversionRate;

  try {
    const [stage] = await db
      .update(schema.funnelStages)
      .set(patch)
      .where(
        and(
          eq(schema.funnelStages.id, input.funnelStageId),
          eq(schema.funnelStages.workspaceId, input.workspaceId),
        ),
      )
      .returning();
    if (!stage) throw new FunnelStageNotFoundError(input.funnelStageId);
    return stage as FunnelStageRecord;
  } catch (error) {
    if (isUniqueViolation(error) && input.orderIndex !== undefined) {
      throw new DuplicateFunnelStageOrderError(input.workspaceId, input.orderIndex);
    }
    throw error;
  }
}

export interface DeleteFunnelStageInput {
  actorUserId: string;
  workspaceId: string;
  funnelStageId: string;
}

/**
 * A hard delete, same accepted exception as notes/bookmarks: a funnel is
 * a structural list a user actively edits (add/remove/reorder stages),
 * not a record with a meaningful status history.
 */
export async function deleteFunnelStage(
  db: Database,
  input: DeleteFunnelStageInput,
): Promise<void> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const [deleted] = await db
    .delete(schema.funnelStages)
    .where(
      and(
        eq(schema.funnelStages.id, input.funnelStageId),
        eq(schema.funnelStages.workspaceId, input.workspaceId),
      ),
    )
    .returning();
  if (!deleted) throw new FunnelStageNotFoundError(input.funnelStageId);
}

export interface CalculateFunnelRequirementsInput {
  actorUserId: string;
  workspaceId: string;
  targetAtFinalStage: number;
}

/**
 * Walks the funnel backward from a target at the last stage (e.g. "50
 * sales") to the volume required at every earlier stage: requiredCount
 * at a stage = the next stage's requiredCount / that next stage's own
 * conversionRate (since conversionRate means "share of the previous
 * stage that reaches this one" - schema.ts's doc comment). The first
 * stage (lowest orderIndex) never needs its own conversionRate for this
 * walk; every other stage does, or the calculation can't proceed
 * (MissingConversionRateError names exactly which one is missing rather
 * than silently producing a wrong number).
 */
export async function calculateFunnelRequirements(
  db: Database,
  input: CalculateFunnelRequirementsInput,
): Promise<FunnelStageRequirement[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const stages = await db
    .select()
    .from(schema.funnelStages)
    .where(eq(schema.funnelStages.workspaceId, input.workspaceId))
    .orderBy(asc(schema.funnelStages.orderIndex));

  if (stages.length === 0) throw new FunnelHasNoStagesError(input.workspaceId);

  const results: FunnelStageRequirement[] = new Array(stages.length);
  let requiredCount = input.targetAtFinalStage;

  for (let i = stages.length - 1; i >= 0; i--) {
    const stage = stages[i];
    if (!stage) throw new Error("Unreachable: index within stages bounds");

    if (i > 0) {
      // This stage's own conversionRate is what maps stage i-1's volume
      // into stage i's volume, so it's needed to keep walking backward
      // past this point - the first stage (i === 0) is the top of the
      // funnel and never needs one.
      if (stage.conversionRate === null) {
        throw new MissingConversionRateError(stage.id, stage.name);
      }
    }

    results[i] = {
      stageId: stage.id,
      name: stage.name,
      orderIndex: stage.orderIndex,
      conversionRate: stage.conversionRate,
      requiredCount,
    };

    if (i > 0 && stage.conversionRate !== null) {
      requiredCount = requiredCount / stage.conversionRate;
    }
  }

  return results;
}
