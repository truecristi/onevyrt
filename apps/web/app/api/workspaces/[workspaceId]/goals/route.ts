import { NextRequest, NextResponse } from "next/server";
import { createGoalRequestSchema } from "@onevyrt/contracts";
import { createGoal, listGoals } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const goals = await listGoals(db, { workspaceId: params.workspaceId, actorUserId: user.id });
    return NextResponse.json({ goals });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = createGoalRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const goal = await createGoal(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      ...(parsed.data.targetDate ? { targetDate: new Date(parsed.data.targetDate) } : {}),
    });
    logger.info("goal created", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      goalId: goal.id,
    });
    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logger.error("goal creation failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}
