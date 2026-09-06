import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type {
  ResolvedScenarioAssumption,
  ScenarioComparison,
  ScenarioType,
} from "@onevyrt/contracts";
import { isUniqueViolation } from "./db-errors";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import {
  ScenarioNotFoundError,
  DuplicateScenarioTypeError,
  AssumptionNotFoundError,
  ScenarioOverrideNotFoundError,
} from "./errors";

/**
 * PRD-NUMBERS-002 vertical slice: scenario modeling (README "Numbers and
 * modeling" -> "Scenario modeling", second slice of Phase 4). Same
 * tenancy shape as assumption-use-cases.ts - requireWorkspaceMembership,
 * every write scoped by workspaceId - since a scenario is a lens over
 * one workspace's own assumptions (schema.ts's scenarios doc comment
 * explains the modeling choice: overrides point at real assumptions
 * rows rather than duplicating a parallel set of numbers).
 */

export interface ScenarioRecord {
  id: string;
  workspaceId: string;
  name: string;
  scenarioType: ScenarioType;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScenarioInput {
  actorUserId: string;
  workspaceId: string;
  name: string;
  scenarioType: ScenarioType;
}

export async function createScenario(
  db: Database,
  input: CreateScenarioInput,
): Promise<ScenarioRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  try {
    return await withTransaction(db, async (tx) => {
      const [scenario] = await tx
        .insert(schema.scenarios)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          scenarioType: input.scenarioType,
        })
        .returning();
      if (!scenario) throw new Error("Failed to create scenario");

      await tx.insert(schema.auditLog).values({
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        action: "scenario.created",
        metadata: { name: scenario.name, scenarioType: scenario.scenarioType },
      });

      return scenario as ScenarioRecord;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateScenarioTypeError(input.workspaceId, input.scenarioType);
    }
    throw error;
  }
}

export interface ListScenariosInput {
  actorUserId: string;
  workspaceId: string;
}

export async function listScenarios(
  db: Database,
  input: ListScenariosInput,
): Promise<ScenarioRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.scenarios)
    .where(eq(schema.scenarios.workspaceId, input.workspaceId));

  return rows as ScenarioRecord[];
}

/** Verifies the scenario belongs to the given workspace - the same cross-entity link-integrity check used throughout Phase 2/3 (e.g. progress-use-cases.ts's requireOwnEnrollmentForLesson). */
async function requireScenarioInWorkspace(
  db: Database,
  scenarioId: string,
  workspaceId: string,
): Promise<void> {
  const scenario = await db.query.scenarios.findFirst({
    where: and(eq(schema.scenarios.id, scenarioId), eq(schema.scenarios.workspaceId, workspaceId)),
  });
  if (!scenario) throw new ScenarioNotFoundError(scenarioId);
}

export interface SetScenarioOverrideInput {
  actorUserId: string;
  workspaceId: string;
  scenarioId: string;
  assumptionId: string;
  value: number;
}

/**
 * Upserts a single override - "current state, not history", the same
 * convention block_responses/lesson_applications use. Never touches the
 * assumption's own baseline value (schema.ts's assumptions.value): the
 * whole point of a scenario is comparing an alternative without
 * disturbing the workspace's actual recorded belief.
 */
export async function setScenarioOverride(
  db: Database,
  input: SetScenarioOverrideInput,
): Promise<void> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  await requireScenarioInWorkspace(db, input.scenarioId, input.workspaceId);

  const assumption = await db.query.assumptions.findFirst({
    where: and(
      eq(schema.assumptions.id, input.assumptionId),
      eq(schema.assumptions.workspaceId, input.workspaceId),
    ),
  });
  if (!assumption) throw new AssumptionNotFoundError(input.assumptionId);

  await withTransaction(db, async (tx) => {
    await tx
      .insert(schema.scenarioAssumptionOverrides)
      .values({
        scenarioId: input.scenarioId,
        assumptionId: input.assumptionId,
        value: input.value,
      })
      .onConflictDoUpdate({
        target: [
          schema.scenarioAssumptionOverrides.scenarioId,
          schema.scenarioAssumptionOverrides.assumptionId,
        ],
        set: { value: input.value, updatedAt: new Date() },
      });

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "scenario.override_set",
      metadata: { scenarioId: input.scenarioId, assumptionId: input.assumptionId },
    });
  });
}

export interface RemoveScenarioOverrideInput {
  actorUserId: string;
  workspaceId: string;
  scenarioId: string;
  assumptionId: string;
}

export async function removeScenarioOverride(
  db: Database,
  input: RemoveScenarioOverrideInput,
): Promise<void> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  await requireScenarioInWorkspace(db, input.scenarioId, input.workspaceId);

  await withTransaction(db, async (tx) => {
    const [deleted] = await tx
      .delete(schema.scenarioAssumptionOverrides)
      .where(
        and(
          eq(schema.scenarioAssumptionOverrides.scenarioId, input.scenarioId),
          eq(schema.scenarioAssumptionOverrides.assumptionId, input.assumptionId),
        ),
      )
      .returning();
    if (!deleted) throw new ScenarioOverrideNotFoundError(input.scenarioId, input.assumptionId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "scenario.override_removed",
      metadata: { scenarioId: input.scenarioId, assumptionId: input.assumptionId },
    });
  });
}

export interface ResolveScenarioAssumptionsInput {
  actorUserId: string;
  workspaceId: string;
  scenarioId: string;
}

/**
 * For every assumption in the workspace, returns its baseline value
 * alongside this scenario's value - the override if one exists,
 * otherwise the same as the baseline. This is "override selected
 * assumptions without modifying the baseline" made concrete: nothing
 * about the assumptions table itself ever changes as a result of
 * resolving or comparing a scenario.
 */
export async function resolveScenarioAssumptions(
  db: Database,
  input: ResolveScenarioAssumptionsInput,
): Promise<ResolvedScenarioAssumption[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  await requireScenarioInWorkspace(db, input.scenarioId, input.workspaceId);

  const workspaceAssumptions = await db
    .select()
    .from(schema.assumptions)
    .where(eq(schema.assumptions.workspaceId, input.workspaceId));

  const overrides = await db
    .select()
    .from(schema.scenarioAssumptionOverrides)
    .where(eq(schema.scenarioAssumptionOverrides.scenarioId, input.scenarioId));
  const overrideByAssumptionId = new Map(overrides.map((o) => [o.assumptionId, o.value]));

  return workspaceAssumptions.map((assumption) => {
    const override = overrideByAssumptionId.get(assumption.id);
    return {
      assumptionId: assumption.id,
      statement: assumption.statement,
      unit: assumption.unit,
      baselineValue: assumption.value,
      scenarioValue: override ?? assumption.value,
      isOverridden: override !== undefined,
    };
  });
}

export interface CompareScenariosInput {
  actorUserId: string;
  workspaceId: string;
  scenarioIds: string[];
}

/**
 * PRD-NUMBERS-007 vertical slice: comparison tools (README "Numbers and
 * modeling" -> "Comparison tools", seventh slice of Phase 4; spec's
 * "Compare: compare scenarios, options, drafts or actual-versus-plan").
 * Same resolution rule as resolveScenarioAssumptions - override if one
 * exists, otherwise the baseline - applied to every requested scenario
 * at once, one row per assumption with a column per scenario, so a
 * side-by-side table needs a single request instead of N.
 */
export async function compareScenarios(
  db: Database,
  input: CompareScenariosInput,
): Promise<ScenarioComparison> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const scenarios = await db
    .select()
    .from(schema.scenarios)
    .where(
      and(
        eq(schema.scenarios.workspaceId, input.workspaceId),
        inArray(schema.scenarios.id, input.scenarioIds),
      ),
    );
  const foundIds = new Set(scenarios.map((s) => s.id));
  const missingId = input.scenarioIds.find((id) => !foundIds.has(id));
  if (missingId) throw new ScenarioNotFoundError(missingId);

  const workspaceAssumptions = await db
    .select()
    .from(schema.assumptions)
    .where(eq(schema.assumptions.workspaceId, input.workspaceId));

  const overrides = await db
    .select()
    .from(schema.scenarioAssumptionOverrides)
    .where(inArray(schema.scenarioAssumptionOverrides.scenarioId, input.scenarioIds));
  const overrideByKey = new Map(
    overrides.map((o) => [`${o.scenarioId}:${o.assumptionId}`, o.value]),
  );

  const rows = workspaceAssumptions.map((assumption) => {
    const valuesByScenarioId: Record<string, number | null> = {};
    for (const scenarioId of input.scenarioIds) {
      const override = overrideByKey.get(`${scenarioId}:${assumption.id}`);
      valuesByScenarioId[scenarioId] = override ?? assumption.value;
    }
    return {
      assumptionId: assumption.id,
      statement: assumption.statement,
      unit: assumption.unit,
      baselineValue: assumption.value,
      valuesByScenarioId,
    };
  });

  // Preserve the caller's requested order rather than the DB's arbitrary one.
  const scenarioById = new Map(scenarios.map((s) => [s.id, s]));
  const orderedScenarios = input.scenarioIds.map((id) => {
    const scenario = scenarioById.get(id);
    if (!scenario) throw new ScenarioNotFoundError(id);
    return {
      id: scenario.id,
      name: scenario.name,
      scenarioType: scenario.scenarioType as ScenarioType,
    };
  });

  return { scenarios: orderedScenarios, rows };
}
