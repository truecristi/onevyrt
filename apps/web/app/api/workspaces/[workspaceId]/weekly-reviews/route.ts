import { NextRequest, NextResponse } from "next/server";
import { getWeeklyReviewQuerySchema, upsertWeeklyReviewRequestSchema } from "@onevyrt/contracts";
import { getWeeklyReview, listWeeklyReviews, upsertWeeklyReview } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * PRD-REVIEW-002: weekly reviews (README "Review and intelligence" ->
 * "Weekly reviews", second slice of Phase 7). With no query, lists every
 * review for the workspace, newest week first. With ?weekOf=..., returns
 * just that week's review (or `{ review: null }` if nobody has saved one
 * yet - a normal state, not an error).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = getWeeklyReviewQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    if (parsed.data.weekOf !== undefined) {
      const review = await getWeeklyReview(db, {
        workspaceId: params.workspaceId,
        actorUserId: user.id,
        weekOf: new Date(parsed.data.weekOf),
      });
      return NextResponse.json({ review });
    }

    const reviews = await listWeeklyReviews(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ reviews });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}

/**
 * Upserts the review for the week containing `weekOf` - one row per
 * workspace per calendar week (see upsertWeeklyReview's doc comment).
 * The first save for a week creates it; every save after that revises
 * it and re-freezes a fresh scorecard snapshot.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = upsertWeeklyReviewRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const review = await upsertWeeklyReview(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      weekOf: new Date(parsed.data.weekOf),
      wins: parsed.data.wins,
      challenges: parsed.data.challenges,
      focusNextWeek: parsed.data.focusNextWeek,
    });
    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
