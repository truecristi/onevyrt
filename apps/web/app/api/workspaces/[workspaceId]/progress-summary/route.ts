import { NextRequest, NextResponse } from "next/server";
import { getProgressSummaryQuerySchema } from "@onevyrt/contracts";
import { getProgressSummary } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * PRD-REVIEW-005: progress summaries (README "Review and intelligence"
 * -> "Progress summaries", fifth slice of Phase 7). Read-only - see
 * getProgressSummary's doc comment: compares the workspace's current
 * scorecard against the closest weekly-review snapshot at or before
 * ?weeksBack weeks ago (default 4), honestly reporting no comparison
 * when the workspace has no review that far back yet.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = getProgressSummaryQuerySchema.safeParse(
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
    const summary = await getProgressSummary(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      ...(parsed.data.weeksBack !== undefined ? { weeksBack: parsed.data.weeksBack } : {}),
    });
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
