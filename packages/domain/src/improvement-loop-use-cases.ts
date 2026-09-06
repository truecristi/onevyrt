import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { RecommendationSource } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { getConstraintDiagnosis } from "./force-assessment-use-cases";
import { getExperimentAnalysis } from "./experiment-analysis-use-cases";
import { getWorkspaceScorecard } from "./scorecard-use-cases";
import {
  ImprovementLoopAlreadyClosedError,
  ImprovementLoopNotFoundError,
  TaskNotFoundError,
} from "./errors";

/**
 * PRD-REVIEW-007 vertical slice: improvement loops (README "Review and
 * intelligence" -> "Improvement loops", seventh and final slice of
 * Phase 7; spec section 2's closed loop). Turns a getRecommendations
 * entry into a tracked commitment - see schema.ts's improvementLoops
 * doc comment for the full reasoning.
 *
 * measureSignal is what makes "did this actually help" answerable
 * without a human's judgment call: each source maps to exactly one
 * number already computed by this phase's other slices
 * (getConstraintDiagnosis/getExperimentAnalysis/getWorkspaceScorecard),
 * and HIGHER_IS_BETTER records, per source, whether a larger number
 * means the signal improved (a force's score, a metric's progress) or
 * worsened (an overdue-task count, an untested-assumption count).
 */

const HIGHER_IS_BETTER: Record<RecommendationSource, boolean> = {
  constraint_diagnosis: true,
  overdue_tasks: false,
  untested_assumptions: false,
  lagging_metric: true,
};

async function measureSignal(
  db: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    source: RecommendationSource;
    relatedId: string | null;
  },
): Promise<number | null> {
  switch (input.source) {
    case "constraint_diagnosis": {
      if (input.relatedId === null) return null;
      const diagnosis = await getConstraintDiagnosis(db, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
      });
      const force = diagnosis.forces.find((f) => f.force === input.relatedId);
      return force?.score ?? null;
    }
    case "lagging_metric": {
      if (input.relatedId === null) return null;
      const scorecard = await getWorkspaceScorecard(db, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
      });
      const metric = scorecard.metrics.metrics.find((m) => m.id === input.relatedId);
      return metric?.progress ?? null;
    }
    case "overdue_tasks": {
      const scorecard = await getWorkspaceScorecard(db, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
      });
      return scorecard.tasks.overdueCount;
    }
    case "untested_assumptions": {
      const analysis = await getExperimentAnalysis(db, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
      });
      return analysis.untestedAssumptionCount;
    }
  }
}

function computeImproved(
  source: RecommendationSource,
  baselineValue: number | null,
  closeValue: number | null,
): boolean | null {
  if (baselineValue === null || closeValue === null) return null;
  return HIGHER_IS_BETTER[source] ? closeValue > baselineValue : closeValue < baselineValue;
}

export interface ImprovementLoopRecord {
  id: string;
  workspaceId: string;
  actorUserId: string;
  source: RecommendationSource;
  relatedId: string | null;
  title: string;
  rationale: string;
  taskId: string | null;
  status: "open" | "closed";
  baselineValue: number | null;
  closeValue: number | null;
  improved: boolean | null;
  outcomeNote: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

export interface StartImprovementLoopInput {
  workspaceId: string;
  actorUserId: string;
  source: RecommendationSource;
  relatedId: string | null;
  title: string;
  rationale: string;
  taskId?: string;
}

async function assertTaskInWorkspace(
  db: Database,
  workspaceId: string,
  taskId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: schema.tasks.id })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)));
  if (!row) throw new TaskNotFoundError(taskId);
}

export async function startImprovementLoop(
  db: Database,
  input: StartImprovementLoopInput,
): Promise<ImprovementLoopRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.taskId !== undefined) {
    await assertTaskInWorkspace(db, input.workspaceId, input.taskId);
  }

  const baselineValue = await measureSignal(db, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    source: input.source,
    relatedId: input.relatedId,
  });

  return withTransaction(db, async (tx) => {
    const [loop] = await tx
      .insert(schema.improvementLoops)
      .values({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        source: input.source,
        relatedId: input.relatedId,
        title: input.title,
        rationale: input.rationale,
        taskId: input.taskId ?? null,
        baselineValue,
      })
      .returning();
    if (!loop) throw new Error("Failed to start improvement loop");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "improvement_loop.started",
      metadata: { loopId: loop.id, source: loop.source },
    });

    return loop as ImprovementLoopRecord;
  });
}

export interface CloseImprovementLoopInput {
  workspaceId: string;
  actorUserId: string;
  loopId: string;
  outcomeNote: string;
}

export async function closeImprovementLoop(
  db: Database,
  input: CloseImprovementLoopInput,
): Promise<ImprovementLoopRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const [existing] = await db
    .select()
    .from(schema.improvementLoops)
    .where(
      and(
        eq(schema.improvementLoops.id, input.loopId),
        eq(schema.improvementLoops.workspaceId, input.workspaceId),
      ),
    );
  if (!existing) throw new ImprovementLoopNotFoundError(input.loopId);
  if (existing.status === "closed") throw new ImprovementLoopAlreadyClosedError(input.loopId);

  const closeValue = await measureSignal(db, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    source: existing.source as RecommendationSource,
    relatedId: existing.relatedId,
  });
  const improved = computeImproved(
    existing.source as RecommendationSource,
    existing.baselineValue,
    closeValue,
  );

  return withTransaction(db, async (tx) => {
    const [loop] = await tx
      .update(schema.improvementLoops)
      .set({
        status: "closed",
        closeValue,
        improved,
        outcomeNote: input.outcomeNote,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.improvementLoops.id, input.loopId),
          eq(schema.improvementLoops.workspaceId, input.workspaceId),
        ),
      )
      .returning();
    if (!loop) throw new ImprovementLoopNotFoundError(input.loopId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "improvement_loop.closed",
      metadata: { loopId: loop.id, improved: loop.improved },
    });

    return loop as ImprovementLoopRecord;
  });
}

export interface ListImprovementLoopsInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listImprovementLoops(
  db: Database,
  input: ListImprovementLoopsInput,
): Promise<ImprovementLoopRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.improvementLoops)
    .where(eq(schema.improvementLoops.workspaceId, input.workspaceId))
    .orderBy(desc(schema.improvementLoops.createdAt));

  return rows as ImprovementLoopRecord[];
}
