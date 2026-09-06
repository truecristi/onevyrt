import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { LaunchChecklistItem, LaunchStatus } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { LaunchNotFoundError, OfferNotFoundError } from "./errors";

/**
 * PRD-BUILD-008 vertical slice: launches (README "Build and execution" ->
 * "Launch workflows", eighth and final slice of Phase 5). Same tenancy
 * shape as the other business-core use cases - requireWorkspaceMembership
 * (ADR-0003), every write scoped by workspaceId in the WHERE clause. See
 * schema.ts's launches table doc comment for the deliberately-scoped
 * "getting a specific offer out the door" focus.
 */

export interface LaunchRecord {
  id: string;
  workspaceId: string;
  name: string;
  offerId: string | null;
  status: LaunchStatus;
  launchDate: Date | null;
  notes: string;
  checklist: LaunchChecklistItem[];
  createdAt: Date;
  updatedAt: Date;
}

/** offerId, if given, must belong to the same workspace - same cross-entity link-integrity check as funnel-step-use-cases.ts's assertOfferInWorkspace. */
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

export interface CreateLaunchInput {
  workspaceId: string;
  actorUserId: string;
  name: string;
  offerId?: string;
  launchDate?: Date;
  notes: string;
  checklist: LaunchChecklistItem[];
}

export async function createLaunch(db: Database, input: CreateLaunchInput): Promise<LaunchRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.offerId !== undefined) {
    await assertOfferInWorkspace(db, input.workspaceId, input.offerId);
  }

  return withTransaction(db, async (tx) => {
    const [launch] = await tx
      .insert(schema.launches)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        offerId: input.offerId ?? null,
        launchDate: input.launchDate ?? null,
        notes: input.notes,
        checklist: input.checklist,
      })
      .returning();
    if (!launch) throw new Error("Failed to create launch");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "launch.created",
      metadata: { name: launch.name },
    });

    return launch as LaunchRecord;
  });
}

export interface ListLaunchesInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listLaunches(
  db: Database,
  input: ListLaunchesInput,
): Promise<LaunchRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.launches)
    .where(eq(schema.launches.workspaceId, input.workspaceId))
    .orderBy(desc(schema.launches.createdAt));

  return rows as LaunchRecord[];
}

export interface UpdateLaunchInput {
  workspaceId: string;
  actorUserId: string;
  launchId: string;
  name?: string;
  /** undefined = leave unchanged; null = detach; a uuid = attach (validated to belong to this workspace). */
  offerId?: string | null;
  status?: LaunchStatus;
  launchDate?: Date | null;
  notes?: string;
  /** Replaces the whole list, same as offer-use-cases.ts's offerComponents/bonuses/objections - not a per-item merge. */
  checklist?: LaunchChecklistItem[];
}

export async function updateLaunch(db: Database, input: UpdateLaunchInput): Promise<LaunchRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.offerId !== undefined && input.offerId !== null) {
    await assertOfferInWorkspace(db, input.workspaceId, input.offerId);
  }

  return withTransaction(db, async (tx) => {
    const patch: Partial<typeof schema.launches.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.offerId !== undefined) patch.offerId = input.offerId;
    if (input.status !== undefined) patch.status = input.status;
    if (input.launchDate !== undefined) patch.launchDate = input.launchDate;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.checklist !== undefined) patch.checklist = input.checklist;

    const [launch] = await tx
      .update(schema.launches)
      .set(patch)
      .where(
        and(
          eq(schema.launches.id, input.launchId),
          eq(schema.launches.workspaceId, input.workspaceId),
        ),
      )
      .returning();

    if (!launch) throw new LaunchNotFoundError(input.launchId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "launch.updated",
      metadata: { launchId: launch.id, status: launch.status },
    });

    return launch as LaunchRecord;
  });
}
