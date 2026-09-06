import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { ExperimentDecision, ExperimentStatus } from "@onevyrt/contracts";
import { requireWorkspaceMembership, getMembership } from "./workspace-use-cases";
import {
  AssumptionNotFoundError,
  ExperimentNotFoundError,
  ExperimentOwnerNotInWorkspaceError,
} from "./errors";

/**
 * PRD-BUILD-006 vertical slice: experiments (README "Build and execution"
 * -> "Experiment system", sixth slice of Phase 5). Same tenancy shape as
 * the other business-core use cases - requireWorkspaceMembership
 * (ADR-0003), every write scoped by workspaceId in the WHERE clause. See
 * schema.ts's experiments table doc comment for the deliberately-small
 * field scope.
 */

export interface ExperimentRecord {
  id: string;
  workspaceId: string;
  name: string;
  hypothesis: string;
  method: string;
  status: ExperimentStatus;
  assumptionId: string | null;
  ownerId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  result: string;
  decision: ExperimentDecision | null;
  createdAt: Date;
  updatedAt: Date;
}

/** assumptionId, if given, must belong to the same workspace - same cross-entity link-integrity check as evidence-use-cases.ts's assertAssumptionInWorkspace. */
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

/** ownerId, if given, must belong to the same workspace - same reasoning as assumption-use-cases.ts's assertOwnerInWorkspace. */
async function assertOwnerInWorkspace(
  db: Database,
  workspaceId: string,
  ownerId: string,
): Promise<void> {
  const membership = await getMembership(db, workspaceId, ownerId);
  if (!membership) throw new ExperimentOwnerNotInWorkspaceError(ownerId, workspaceId);
}

export interface CreateExperimentInput {
  workspaceId: string;
  actorUserId: string;
  name: string;
  hypothesis: string;
  method: string;
  assumptionId?: string;
  ownerId?: string;
}

export async function createExperiment(
  db: Database,
  input: CreateExperimentInput,
): Promise<ExperimentRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.assumptionId !== undefined) {
    await assertAssumptionInWorkspace(db, input.workspaceId, input.assumptionId);
  }
  if (input.ownerId !== undefined) {
    await assertOwnerInWorkspace(db, input.workspaceId, input.ownerId);
  }

  return withTransaction(db, async (tx) => {
    const [experiment] = await tx
      .insert(schema.experiments)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        hypothesis: input.hypothesis,
        method: input.method,
        assumptionId: input.assumptionId ?? null,
        ownerId: input.ownerId ?? null,
      })
      .returning();
    if (!experiment) throw new Error("Failed to create experiment");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "experiment.created",
      metadata: { name: experiment.name },
    });

    return experiment as ExperimentRecord;
  });
}

export interface ListExperimentsInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listExperiments(
  db: Database,
  input: ListExperimentsInput,
): Promise<ExperimentRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.experiments)
    .where(eq(schema.experiments.workspaceId, input.workspaceId))
    .orderBy(desc(schema.experiments.createdAt));

  return rows as ExperimentRecord[];
}

export interface UpdateExperimentInput {
  workspaceId: string;
  actorUserId: string;
  experimentId: string;
  name?: string;
  hypothesis?: string;
  method?: string;
  status?: ExperimentStatus;
  /** undefined = leave unchanged; null = detach; a uuid = attach (validated to belong to this workspace). */
  assumptionId?: string | null;
  ownerId?: string | null;
  result?: string;
  decision?: ExperimentDecision | null;
}

/**
 * Sets startedAt the first time status becomes "running", and endedAt the
 * first time it becomes "completed" or "abandoned" - same reasoning as
 * task-use-cases.ts's updateTaskStatus and its completedAt: these are real
 * derived facts about when the experiment actually moved into that state,
 * not left for a caller to backfill by hand. Unlike completedAt, moving
 * status back out of a terminal state does not clear endedAt - an
 * experiment that was completed and later reopened for a retest still
 * genuinely did end once; that history isn't erased, only extended by
 * whatever startedAt/endedAt a subsequent run sets on top of it in a real
 * multi-run system, which is out of this slice's deliberately-small scope
 * (see schema.ts's experiments table doc comment).
 */
export async function updateExperiment(
  db: Database,
  input: UpdateExperimentInput,
): Promise<ExperimentRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.assumptionId !== undefined && input.assumptionId !== null) {
    await assertAssumptionInWorkspace(db, input.workspaceId, input.assumptionId);
  }
  if (input.ownerId !== undefined && input.ownerId !== null) {
    await assertOwnerInWorkspace(db, input.workspaceId, input.ownerId);
  }

  return withTransaction(db, async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.experiments)
      .where(
        and(
          eq(schema.experiments.id, input.experimentId),
          eq(schema.experiments.workspaceId, input.workspaceId),
        ),
      );
    if (!existing) throw new ExperimentNotFoundError(input.experimentId);

    const patch: Partial<typeof schema.experiments.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.hypothesis !== undefined) patch.hypothesis = input.hypothesis;
    if (input.method !== undefined) patch.method = input.method;
    if (input.assumptionId !== undefined) patch.assumptionId = input.assumptionId;
    if (input.ownerId !== undefined) patch.ownerId = input.ownerId;
    if (input.result !== undefined) patch.result = input.result;
    if (input.decision !== undefined) patch.decision = input.decision;
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "running" && existing.startedAt === null) {
        patch.startedAt = new Date();
      }
      if (
        (input.status === "completed" || input.status === "abandoned") &&
        existing.endedAt === null
      ) {
        patch.endedAt = new Date();
      }
    }

    const [experiment] = await tx
      .update(schema.experiments)
      .set(patch)
      .where(
        and(
          eq(schema.experiments.id, input.experimentId),
          eq(schema.experiments.workspaceId, input.workspaceId),
        ),
      )
      .returning();
    if (!experiment) throw new ExperimentNotFoundError(input.experimentId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "experiment.updated",
      metadata: { experimentId: experiment.id, status: experiment.status },
    });

    return experiment as ExperimentRecord;
  });
}
