import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { OfferStatus } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { OfferNotFoundError } from "./errors";

/**
 * PRD-BIZCORE-004 vertical slice: offers. Same tenancy shape as the other
 * business-core use cases - re-derive membership via
 * requireWorkspaceMembership (ADR-0003), fail closed, scope every write by
 * workspaceId in the WHERE clause.
 */

export interface OfferRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  priceCents: number | null;
  currency: string;
  status: OfferStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOfferInput {
  workspaceId: string;
  actorUserId: string;
  name: string;
  description: string;
  currency: string;
  priceCents?: number;
}

export async function createOffer(db: Database, input: CreateOfferInput): Promise<OfferRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const [offer] = await tx
      .insert(schema.offers)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        currency: input.currency,
        priceCents: input.priceCents ?? null,
      })
      .returning();
    if (!offer) throw new Error("Failed to create offer");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "offer.created",
      metadata: { name: offer.name },
    });

    return offer as OfferRecord;
  });
}

export interface ListOffersInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listOffers(db: Database, input: ListOffersInput): Promise<OfferRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.offers)
    .where(eq(schema.offers.workspaceId, input.workspaceId))
    .orderBy(desc(schema.offers.createdAt));

  return rows as OfferRecord[];
}

export interface UpdateOfferInput {
  workspaceId: string;
  actorUserId: string;
  offerId: string;
  name?: string;
  description?: string;
  currency?: string;
  status?: OfferStatus;
  /** undefined = leave unchanged; null = clear the price; a number = set it. */
  priceCents?: number | null;
}

/** A partial update, same semantics as updateCustomerProfile - except priceCents, which distinguishes "not provided" (undefined, unchanged) from "explicitly cleared" (null) since a price genuinely can be absent. */
export async function updateOffer(db: Database, input: UpdateOfferInput): Promise<OfferRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const patch: Partial<typeof schema.offers.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.status !== undefined) patch.status = input.status;
    if (input.priceCents !== undefined) patch.priceCents = input.priceCents;

    const [offer] = await tx
      .update(schema.offers)
      .set(patch)
      .where(
        and(eq(schema.offers.id, input.offerId), eq(schema.offers.workspaceId, input.workspaceId)),
      )
      .returning();

    if (!offer) throw new OfferNotFoundError(input.offerId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "offer.updated",
      metadata: { offerId: offer.id, status: offer.status },
    });

    return offer as OfferRecord;
  });
}
