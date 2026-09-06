import { NextRequest, NextResponse } from "next/server";
import { compareScenariosRequestSchema } from "@onevyrt/contracts";
import { compareScenarios, ScenarioNotFoundError } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string };
}

// A dedicated computation route, same reasoning as the formula compute
// and funnel requirements routes: the comparison table is derived fresh
// from the workspace's current assumptions and scenario overrides,
// never stored.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = compareScenariosRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const comparison = await compareScenarios(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      scenarioIds: parsed.data.scenarioIds,
    });
    return NextResponse.json({ comparison });
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
