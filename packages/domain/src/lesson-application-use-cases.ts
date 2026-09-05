import { eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import type { ApplicationResourceType } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { requireOwnEnrollmentForBlock } from "./block-response-use-cases";
import {
  BlockTypeMismatchError,
  LessonApplicationResourceNotFoundError,
  EnrollmentNotFoundError,
} from "./errors";

/**
 * PRD-CURRICULUM-007 vertical slice: lesson application. Links a
 * learner's build/practice/implementation block to the real Phase 2
 * business record it produced - the concrete tie between curriculum
 * (platform-wide) and business data (workspace-owned).
 *
 * Two ownership checks compose here, not one: requireOwnEnrollmentForBlock
 * (the block belongs to a lesson in the caller's own enrollment) and
 * requireWorkspaceMembership (the caller actually belongs to the
 * workspace the resource lives in) - a learner could otherwise point an
 * application at a resource in a workspace they don't belong to.
 */

const APPLICATION_BLOCK_TYPES = ["build", "practice", "implementation"] as const;

export interface LessonApplicationRecord {
  id: string;
  enrollmentId: string;
  lessonBlockId: string;
  workspaceId: string;
  resourceType: ApplicationResourceType;
  resourceId: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The resource must actually exist and belong to the given workspace -
 * checked per resourceType against its real table, since resource_id is
 * polymorphic and has no foreign key (see the schema.ts doc comment).
 */
async function assertResourceInWorkspace(
  db: Database,
  resourceType: ApplicationResourceType,
  resourceId: string,
  workspaceId: string,
): Promise<void> {
  let row: { workspaceId: string } | undefined;

  switch (resourceType) {
    case "goal":
      row = await db.query.goals.findFirst({
        where: eq(schema.goals.id, resourceId),
        columns: { workspaceId: true },
      });
      break;
    case "task":
      row = await db.query.tasks.findFirst({
        where: eq(schema.tasks.id, resourceId),
        columns: { workspaceId: true },
      });
      break;
    case "offer":
      row = await db.query.offers.findFirst({
        where: eq(schema.offers.id, resourceId),
        columns: { workspaceId: true },
      });
      break;
    case "customer_profile":
      row = await db.query.customerProfiles.findFirst({
        where: eq(schema.customerProfiles.id, resourceId),
        columns: { workspaceId: true },
      });
      break;
    case "business_metric":
      row = await db.query.businessMetrics.findFirst({
        where: eq(schema.businessMetrics.id, resourceId),
        columns: { workspaceId: true },
      });
      break;
    case "assumption":
      row = await db.query.assumptions.findFirst({
        where: eq(schema.assumptions.id, resourceId),
        columns: { workspaceId: true },
      });
      break;
    case "decision":
      row = await db.query.decisions.findFirst({
        where: eq(schema.decisions.id, resourceId),
        columns: { workspaceId: true },
      });
      break;
  }

  if (!row || row.workspaceId !== workspaceId) {
    throw new LessonApplicationResourceNotFoundError(resourceType, resourceId, workspaceId);
  }
}

export interface SubmitLessonApplicationInput {
  actorUserId: string;
  enrollmentId: string;
  lessonBlockId: string;
  workspaceId: string;
  resourceType: ApplicationResourceType;
  resourceId: string;
  note: string;
}

/** Resubmitting (a different resource, or an edited note) overwrites the current application - "what this block currently produced", not a history log, same as block responses. */
export async function submitLessonApplication(
  db: Database,
  input: SubmitLessonApplicationInput,
): Promise<LessonApplicationRecord> {
  const block = await requireOwnEnrollmentForBlock(
    db,
    input.enrollmentId,
    input.lessonBlockId,
    input.actorUserId,
  );
  if (
    !APPLICATION_BLOCK_TYPES.includes(block.blockType as (typeof APPLICATION_BLOCK_TYPES)[number])
  ) {
    throw new BlockTypeMismatchError(
      input.lessonBlockId,
      APPLICATION_BLOCK_TYPES.join("/"),
      block.blockType,
    );
  }

  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  await assertResourceInWorkspace(db, input.resourceType, input.resourceId, input.workspaceId);

  const [application] = await db
    .insert(schema.lessonApplications)
    .values({
      enrollmentId: input.enrollmentId,
      lessonBlockId: input.lessonBlockId,
      workspaceId: input.workspaceId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      note: input.note,
    })
    .onConflictDoUpdate({
      target: [schema.lessonApplications.enrollmentId, schema.lessonApplications.lessonBlockId],
      set: {
        workspaceId: input.workspaceId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        note: input.note,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!application) throw new Error("Failed to record lesson application");
  return application as LessonApplicationRecord;
}

export interface ListLessonApplicationsForEnrollmentInput {
  actorUserId: string;
  enrollmentId: string;
}

export async function listLessonApplicationsForEnrollment(
  db: Database,
  input: ListLessonApplicationsForEnrollmentInput,
): Promise<LessonApplicationRecord[]> {
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(schema.enrollments.id, input.enrollmentId),
  });
  if (!enrollment || enrollment.userId !== input.actorUserId) {
    throw new EnrollmentNotFoundError(input.enrollmentId);
  }

  const rows = await db
    .select()
    .from(schema.lessonApplications)
    .where(eq(schema.lessonApplications.enrollmentId, input.enrollmentId));
  return rows as LessonApplicationRecord[];
}
