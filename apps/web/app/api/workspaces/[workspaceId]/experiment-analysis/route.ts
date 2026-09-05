import { NextRequest, NextResponse } from "next/server";
import { getExperimentAnalysis } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * PRD-REVIEW-003: experiment analysis (README "Review and intelligence"
 * -> "Experiment analysis", third slice of Phase 7). Read-only
 * aggregation - see getExperimentAnalysis's doc comment: not a new
 * source of truth, a deeper lens on experiments and assumptions than
 * the scorecard's simple counts (cycle time, assumption test coverage).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const analysis = await getExperimentAnalysis(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ analysis });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
