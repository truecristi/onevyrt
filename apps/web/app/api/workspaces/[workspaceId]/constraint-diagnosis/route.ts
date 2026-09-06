import { NextRequest, NextResponse } from "next/server";
import { getConstraintDiagnosis } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * PRD-REVIEW-004: constraint diagnosis (README "Review and
 * intelligence" -> "Constraint diagnosis", fourth slice of Phase 7).
 * Read-only - see getConstraintDiagnosis's doc comment: ranks whatever
 * forces have actually been assessed (.../force-assessments) by score
 * ascending and names the weakest as the primary constraint, without
 * ever guessing at a force nobody has scored yet.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const diagnosis = await getConstraintDiagnosis(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ diagnosis });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
