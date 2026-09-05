import { NextRequest, NextResponse } from "next/server";
import { resolveScenarioAssumptions, ScenarioNotFoundError } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

interface RouteParams {
  params: { workspaceId: string; scenarioId: string };
}

// Read-only: every assumption in the workspace with its baseline value
// alongside this scenario's value (the override if one exists) - see
// resolveScenarioAssumptions' doc comment.
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const assumptions = await resolveScenarioAssumptions(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      scenarioId: params.scenarioId,
    });
    return NextResponse.json({ assumptions });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ScenarioNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
