import { NextRequest, NextResponse } from "next/server";
import { getRecommendations } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * PRD-REVIEW-006: recommendation ranking (README "Review and
 * intelligence" -> "Recommendation ranking", sixth slice of Phase 7).
 * Read-only - see getRecommendations's doc comment: a deterministic,
 * rule-based ranking over this workspace's constraint diagnosis,
 * experiment analysis and scorecard, not AI-generated.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const recommendations = await getRecommendations(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ recommendations });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
