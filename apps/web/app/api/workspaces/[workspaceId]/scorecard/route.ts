import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceScorecard } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * PRD-REVIEW-001: scorecards (README "Review and intelligence" ->
 * "Scorecards", first slice of Phase 7). Read-only aggregation - one
 * round trip instead of four separate list calls. See
 * getWorkspaceScorecard's doc comment: not a new source of truth, just a
 * consolidated accountability-shaped view over existing goals, tasks,
 * experiments and business metrics.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const scorecard = await getWorkspaceScorecard(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ scorecard });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
