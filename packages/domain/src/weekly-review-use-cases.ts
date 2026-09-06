import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { getWorkspaceScorecard, type WorkspaceScorecardRecord } from "./scorecard-use-cases";

/**
 * PRD-REVIEW-002 vertical slice: weekly reviews (README "Review and
 * intelligence" -> "Weekly reviews", second slice of Phase 7; spec
 * section 6.18's "weekly review"). One review per workspace per calendar
 * week - upsertWeeklyReview creates it on the first save for a given
 * week and updates it on every save after, the same atomic
 * `INSERT ... ON CONFLICT DO UPDATE` pattern business-core-use-cases.ts's
 * upsertBusinessProfile uses for "one profile per workspace" (avoids the
 * same check-then-act race a naive find-or-create would hit).
 *
 * Every save freezes the workspace's current scorecard (Phase 7 first
 * slice, getWorkspaceScorecard) into scorecardSnapshot - a scorecard
 * itself is never persisted (it's a live aggregation), but a weekly
 * review is exactly the point-in-time record a later review can be
 * compared against.
 */

export interface WeeklyReviewRecord {
  id: string;
  workspaceId: string;
  authorUserId: string;
  weekStartDate: Date;
  wins: string;
  challenges: string;
  focusNextWeek: string;
  scorecardSnapshot: WorkspaceScorecardRecord;
  createdAt: Date;
  updatedAt: Date;
}

/** Normalizes any date to that ISO week's Monday, at 00:00:00 UTC - so any date the caller passes for "the week of ..." lands on the same row. */
export function toWeekStart(date: Date): Date {
  const utcMidnight = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utcMidnight.getUTCDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - daysSinceMonday);
  return utcMidnight;
}

export interface UpsertWeeklyReviewInput {
  workspaceId: string;
  actorUserId: string;
  weekOf: Date;
  wins: string;
  challenges: string;
  focusNextWeek: string;
}

export async function upsertWeeklyReview(
  db: Database,
  input: UpsertWeeklyReviewInput,
): Promise<WeeklyReviewRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const scorecardSnapshot = await getWorkspaceScorecard(db, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
  });
  const weekStartDate = toWeekStart(input.weekOf);

  return withTransaction(db, async (tx) => {
    const values = {
      authorUserId: input.actorUserId,
      wins: input.wins,
      challenges: input.challenges,
      focusNextWeek: input.focusNextWeek,
      scorecardSnapshot,
      updatedAt: new Date(),
    };

    const [review] = await tx
      .insert(schema.weeklyReviews)
      .values({ workspaceId: input.workspaceId, weekStartDate, ...values })
      .onConflictDoUpdate({
        target: [schema.weeklyReviews.workspaceId, schema.weeklyReviews.weekStartDate],
        set: values,
      })
      .returning();
    if (!review) throw new Error("Failed to save weekly review");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "weekly_review.saved",
      metadata: { weekStartDate: weekStartDate.toISOString() },
    });

    return review as WeeklyReviewRecord;
  });
}

export interface ListWeeklyReviewsInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listWeeklyReviews(
  db: Database,
  input: ListWeeklyReviewsInput,
): Promise<WeeklyReviewRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.weeklyReviews)
    .where(eq(schema.weeklyReviews.workspaceId, input.workspaceId))
    .orderBy(desc(schema.weeklyReviews.weekStartDate));

  return rows as WeeklyReviewRecord[];
}

export interface GetWeeklyReviewInput {
  workspaceId: string;
  actorUserId: string;
  weekOf: Date;
}

/** Returns null rather than throwing when this week has no review yet - that's the normal state for a week nobody has reviewed, not an error. */
export async function getWeeklyReview(
  db: Database,
  input: GetWeeklyReviewInput,
): Promise<WeeklyReviewRecord | null> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const weekStartDate = toWeekStart(input.weekOf);
  const [row] = await db
    .select()
    .from(schema.weeklyReviews)
    .where(
      and(
        eq(schema.weeklyReviews.workspaceId, input.workspaceId),
        eq(schema.weeklyReviews.weekStartDate, weekStartDate),
      ),
    );

  return (row as WeeklyReviewRecord | undefined) ?? null;
}
