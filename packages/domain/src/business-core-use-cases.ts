import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import { assertCanReadWorkspace } from "@onevyrt/auth";
import type { BusinessStage, GoalStatus } from "@onevyrt/contracts";
import { getMembership } from "./workspace-use-cases";
import { GoalNotFoundError } from "./errors";

/**
 * PRD-BIZCORE-001/002 vertical slice: the canonical business record and
 * goals (README Phase 2, first slice; master spec §2.3's Workspace ->
 * Business -> ... -> Outcome graph). Every function here re-derives the
 * caller's membership from the DB and fails closed via
 * assertCanReadWorkspace - the same tenancy guarantee ADR-0003 documents
 * for Phase 1, extended to a new table rather than re-invented.
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

/** One profile per workspace - creates it on first call, updates it on every call after (an "upsert", not a create-only or update-only operation). */
export async function upsertBusinessProfile(
  db: Database,
  input: UpsertBusinessProfileInput,
): Promise<BusinessProfileRecord> {
  const membership = await getMembership(db, input.workspaceId, input.actorUserId);
  assertCanReadWorkspace(membership, input.workspaceId);

  return withTransaction(db, async (tx) => {
    const existing = await tx.query.businessProfiles.findFirst({
      where: eq(schema.businessProfiles.workspaceId, input.workspaceId),
    });

    const values = {
      name: input.name,
      vision: input.vision,
      mission: input.mission,
      industry: input.industry,
      stage: input.stage,
      updatedAt: new Date(),
    };

    const [profile] = existing
      ? await tx
          .update(schema.businessProfiles)
          .set(values)
          .where(eq(schema.businessProfiles.workspaceId, input.workspaceId))
          .returning()
      : await tx
          .insert(schema.businessProfiles)
          .values({ workspaceId: input.workspaceId, ...values })
          .returning();

    if (!profile) throw new Error("Failed to save business profile");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: existing ? "business_profile.updated" : "business_profile.created",
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
  const membership = await getMembership(db, input.workspaceId, input.actorUserId);
  assertCanReadWorkspace(membership, input.workspaceId);

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
  const membership = await getMembership(db, input.workspaceId, input.actorUserId);
  assertCanReadWorkspace(membership, input.workspaceId);

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
  const membership = await getMembership(db, input.workspaceId, input.actorUserId);
  assertCanReadWorkspace(membership, input.workspaceId);

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
  const membership = await getMembership(db, input.workspaceId, input.actorUserId);
  assertCanReadWorkspace(membership, input.workspaceId);

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
