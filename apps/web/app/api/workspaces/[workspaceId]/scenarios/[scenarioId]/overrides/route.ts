import { NextRequest, NextResponse } from "next/server";
import { setScenarioOverrideRequestSchema } from "@onevyrt/contracts";
import {
  setScenarioOverride,
  ScenarioNotFoundError,
  AssumptionNotFoundError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; scenarioId: string };
}

// Upsert, not append - see setScenarioOverride's doc comment. POSTing
// the same assumptionId again just replaces the override's value.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = setScenarioOverrideRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    await setScenarioOverride(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      scenarioId: params.scenarioId,
      assumptionId: parsed.data.assumptionId,
      value: parsed.data.value,
    });
    logger.info("scenario override set", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      scenarioId: params.scenarioId,
      assumptionId: parsed.data.assumptionId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ScenarioNotFoundError || error instanceof AssumptionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("scenario override set failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to set scenario override" }, { status: 500 });
  }
}
