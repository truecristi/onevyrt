import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import { assertCanReadWorkspace } from "@onevyrt/auth";
import { getMembership } from "./workspace-use-cases";
import { CustomerProfileNotFoundError } from "./errors";

/**
 * PRD-BIZCORE-003 vertical slice: customer profiles. Same tenancy shape as
 * business-core-use-cases.ts - every function re-derives membership and
 * fails closed via assertCanReadWorkspace, and every write is scoped by
 * workspaceId in the WHERE clause, not just the row's own id.
 */

export interface CustomerProfileRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  painPoints: string;
  desiredOutcome: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerProfileInput {
  workspaceId: string;
  actorUserId: string;
  name: string;
  description: string;
  painPoints: string;
  desiredOutcome: string;
}

export async function createCustomerProfile(
  db: Database,
  input: CreateCustomerProfileInput,
): Promise<CustomerProfileRecord> {
  const membership = await getMembership(db, input.workspaceId, input.actorUserId);
  assertCanReadWorkspace(membership, input.workspaceId);

  return withTransaction(db, async (tx) => {
    const [profile] = await tx
      .insert(schema.customerProfiles)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        painPoints: input.painPoints,
        desiredOutcome: input.desiredOutcome,
      })
      .returning();
    if (!profile) throw new Error("Failed to create customer profile");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "customer_profile.created",
      metadata: { name: profile.name },
    });

    return profile as CustomerProfileRecord;
  });
}

export interface ListCustomerProfilesInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listCustomerProfiles(
  db: Database,
  input: ListCustomerProfilesInput,
): Promise<CustomerProfileRecord[]> {
  const membership = await getMembership(db, input.workspaceId, input.actorUserId);
  assertCanReadWorkspace(membership, input.workspaceId);

  const rows = await db
    .select()
    .from(schema.customerProfiles)
    .where(eq(schema.customerProfiles.workspaceId, input.workspaceId))
    .orderBy(desc(schema.customerProfiles.createdAt));

  return rows as CustomerProfileRecord[];
}

export interface UpdateCustomerProfileInput {
  workspaceId: string;
  actorUserId: string;
  customerProfileId: string;
  name?: string;
  description?: string;
  painPoints?: string;
  desiredOutcome?: string;
}

/** A partial update - only fields actually present in the input are changed; omitted fields keep their current value. */
export async function updateCustomerProfile(
  db: Database,
  input: UpdateCustomerProfileInput,
): Promise<CustomerProfileRecord> {
  const membership = await getMembership(db, input.workspaceId, input.actorUserId);
  assertCanReadWorkspace(membership, input.workspaceId);

  return withTransaction(db, async (tx) => {
    const patch: Partial<typeof schema.customerProfiles.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.painPoints !== undefined) patch.painPoints = input.painPoints;
    if (input.desiredOutcome !== undefined) patch.desiredOutcome = input.desiredOutcome;

    const [profile] = await tx
      .update(schema.customerProfiles)
      .set(patch)
      .where(
        and(
          eq(schema.customerProfiles.id, input.customerProfileId),
          eq(schema.customerProfiles.workspaceId, input.workspaceId),
        ),
      )
      .returning();

    if (!profile) throw new CustomerProfileNotFoundError(input.customerProfileId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "customer_profile.updated",
      metadata: { customerProfileId: profile.id },
    });

    return profile as CustomerProfileRecord;
  });
}
