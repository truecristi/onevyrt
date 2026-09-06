import { NextRequest, NextResponse } from "next/server";
import { updateGoalRequestSchema } from "@onevyrt/contracts";
import { updateGoalStatus, GoalNotFoundError } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; goalId: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = updateGoalRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const goal = await updateGoalStatus(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      goalId: params.goalId,
      status: parsed.data.status,
    });
    logger.info("goal status changed", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      goalId: goal.id,
    });
    return NextResponse.json({ goal });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof GoalNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("goal update failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}
