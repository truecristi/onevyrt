import { NextRequest, NextResponse } from "next/server";
import {
  removeScenarioOverride,
  ScenarioNotFoundError,
  ScenarioOverrideNotFoundError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; scenarioId: string; assumptionId: string };
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { db } = getServerContext();

  try {
    await removeScenarioOverride(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      scenarioId: params.scenarioId,
      assumptionId: params.assumptionId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ScenarioNotFoundError || error instanceof ScenarioOverrideNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("scenario override removal failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to remove scenario override" }, { status: 500 });
  }
}
