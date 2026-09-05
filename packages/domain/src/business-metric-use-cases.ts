import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { MetricCadence, MetricDirection } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { BusinessMetricNotFoundError } from "./errors";

/**
 * PRD-BIZCORE-006 vertical slice: business metrics. Same tenancy shape as
 * the other business-core use cases - requireWorkspaceMembership
 * (ADR-0003), every write scoped by workspaceId in the WHERE clause.
 */

export interface BusinessMetricRecord {
  id: string;
  workspaceId: string;
  name: string;
  unit: string;
  direction: MetricDirection;
  cadence: MetricCadence;
  baselineValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBusinessMetricInput {
  workspaceId: string;
  actorUserId: string;
  name: string;
  unit: string;
  direction: MetricDirection;
  cadence: MetricCadence;
  baselineValue?: number;
  targetValue?: number;
  currentValue?: number;
}

export async function createBusinessMetric(
  db: Database,
  input: CreateBusinessMetricInput,
): Promise<BusinessMetricRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const [metric] = await tx
      .insert(schema.businessMetrics)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        unit: input.unit,
        direction: input.direction,
        cadence: input.cadence,
        baselineValue: input.baselineValue ?? null,
        targetValue: input.targetValue ?? null,
        currentValue: input.currentValue ?? null,
      })
      .returning();
    if (!metric) throw new Error("Failed to create business metric");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "business_metric.created",
      metadata: { name: metric.name },
    });

    return metric as BusinessMetricRecord;
  });
}

export interface ListBusinessMetricsInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listBusinessMetrics(
  db: Database,
  input: ListBusinessMetricsInput,
): Promise<BusinessMetricRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.businessMetrics)
    .where(eq(schema.businessMetrics.workspaceId, input.workspaceId))
    .orderBy(desc(schema.businessMetrics.createdAt));

  return rows as BusinessMetricRecord[];
}

export interface UpdateBusinessMetricInput {
  workspaceId: string;
  actorUserId: string;
  metricId: string;
  name?: string;
  unit?: string;
  direction?: MetricDirection;
  cadence?: MetricCadence;
  /** undefined = leave unchanged; null = clear the value; a number = set it. */
  baselineValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
}

/**
 * A partial update, same undefined-vs-null semantics as updateOffer's
 * priceCents: a metric can genuinely have no baseline/target/current value
 * yet, so callers need a way to explicitly clear one, distinct from simply
 * not mentioning it in the patch.
 */
export async function updateBusinessMetric(
  db: Database,
  input: UpdateBusinessMetricInput,
): Promise<BusinessMetricRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const patch: Partial<typeof schema.businessMetrics.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.unit !== undefined) patch.unit = input.unit;
    if (input.direction !== undefined) patch.direction = input.direction;
    if (input.cadence !== undefined) patch.cadence = input.cadence;
    if (input.baselineValue !== undefined) patch.baselineValue = input.baselineValue;
    if (input.targetValue !== undefined) patch.targetValue = input.targetValue;
    if (input.currentValue !== undefined) patch.currentValue = input.currentValue;

    const [metric] = await tx
      .update(schema.businessMetrics)
      .set(patch)
      .where(
        and(
          eq(schema.businessMetrics.id, input.metricId),
          eq(schema.businessMetrics.workspaceId, input.workspaceId),
        ),
      )
      .returning();

    if (!metric) throw new BusinessMetricNotFoundError(input.metricId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "business_metric.updated",
      metadata: { metricId: metric.id },
    });

    return metric as BusinessMetricRecord;
  });
}
