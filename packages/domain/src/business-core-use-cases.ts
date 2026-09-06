import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { BusinessStage, GoalStatus } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { GoalNotFoundError } from "./errors";

/**
 * PRD-BIZCORE-001/002 vertical slice: the canonical business record and
 * goals (README Phase 2, first slice; master spec §2.3's Workspace ->
 * Business -> ... -> Outcome graph). Every function here re-derives the
 * caller's membership via requireWorkspaceMembership and fails closed -
 * the same tenancy guarantee ADR-0003 documents for Phase 1, extended to
 * new tables rather than re-invented.
 */

export interface BusinessProfileRecord {
  id: string;
  workspaceId: string;
  name: string;
  vision: string;
  mission: string;
  industry: string;
  stage: BusinessStage;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertBusinessProfileInput {
  workspaceId: string;
  actorUserId: string;
  name: string;
  vision: string;
  mission: string;
  industry: string;
  stage: BusinessStage;
}

/**
 * One profile per workspace - creates it on first call, updates it on
 * every call after.
 *
 * A code review of the original version (check existing, then INSERT or
 * UPDATE accordingly) found it was a non-atomic check-then-act: two
 * concurrent first-time saves for the same workspace could both see "no
 * existing profile" and both attempt an INSERT, and the second would hit
 * `business_profiles.workspace_id`'s UNIQUE constraint as an unhandled
 * error. Rewritten as a single atomic `INSERT ... ON CONFLICT (workspace_id)
 * DO UPDATE`, so the database - not a race-prone read-then-write - is what
 * actually guarantees "one profile per workspace." The trade-off: the
 * audit log can no longer distinguish "created" from "updated" without an
 * extra query, so it records one "business_profile.saved" action instead
 * of two - a reasonable cost for removing the race entirely.
 */
export async function upsertBusinessProfile(
  db: Database,
  input: UpsertBusinessProfileInput,
): Promise<BusinessProfileRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const values = {
      name: input.name,
      vision: input.vision,
      mission: input.mission,
      industry: input.industry,
      stage: input.stage,
      updatedAt: new Date(),
    };

    const [profile] = await tx
      .insert(schema.businessProfiles)
      .values({ workspaceId: input.workspaceId, ...values })
      .onConflictDoUpdate({ target: schema.businessProfiles.workspaceId, set: values })
      .returning();

    if (!profile) throw new Error("Failed to save business profile");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "business_profile.saved",
      metadata: { name: profile.name, stage: profile.stage },
    });

    return profile as BusinessProfileRecord;
  });
}

export interface GetBusinessProfileInput {
  workspaceId: string;
  actorUserId: string;
}

export async function getBusinessProfile(
  db: Database,
  input: GetBusinessProfileInput,
): Promise<BusinessProfileRecord | null> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const profile = await db.query.businessProfiles.findFirst({
    where: eq(schema.businessProfiles.workspaceId, input.workspaceId),
  });
  return (profile as BusinessProfileRecord) ?? null;
}

export interface GoalRecord {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  targetDate: Date | null;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGoalInput {
  workspaceId: string;
  actorUserId: string;
  title: string;
  description: string;
  targetDate?: Date;
}

export async function createGoal(db: Database, input: CreateGoalInput): Promise<GoalRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const [goal] = await tx
      .insert(schema.goals)
      .values({
        workspaceId: input.workspaceId,
        title: input.title,
        description: input.description,
        targetDate: input.targetDate ?? null,
      })
      .returning();
    if (!goal) throw new Error("Failed to create goal");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "goal.created",
      metadata: { title: goal.title },
    });

    return goal as GoalRecord;
  });
}

export interface ListGoalsInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listGoals(db: Database, input: ListGoalsInput): Promise<GoalRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.goals)
    .where(eq(schema.goals.workspaceId, input.workspaceId))
    .orderBy(desc(schema.goals.createdAt));

  return rows as GoalRecord[];
}

export interface UpdateGoalStatusInput {
  workspaceId: string;
  actorUserId: string;
  goalId: string;
  status: GoalStatus;
}

/** Scoped by workspaceId in the WHERE clause, not just goalId, so a goal ID from another workspace can never be updated even if guessed (§4's "every query must include the active workspace boundary"). */
export async function updateGoalStatus(
  db: Database,
  input: UpdateGoalStatusInput,
): Promise<GoalRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const [goal] = await tx
      .update(schema.goals)
      .set({ status: input.status, updatedAt: new Date() })
      .where(
        and(eq(schema.goals.id, input.goalId), eq(schema.goals.workspaceId, input.workspaceId)),
      )
      .returning();

    if (!goal) throw new GoalNotFoundError(input.goalId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "goal.status_changed",
      metadata: { goalId: goal.id, status: goal.status },
    });

    return goal as GoalRecord;
  });
}
