import { NextRequest, NextResponse } from "next/server";
import { createFunnelStageRequestSchema } from "@onevyrt/contracts";
import {
  createFunnelStage,
  listFunnelStages,
  DuplicateFunnelStageOrderError,
} from "@onevyrt/domain";
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
    const stages = await listFunnelStages(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ stages });
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

  const parsed = createFunnelStageRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const stage = await createFunnelStage(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      name: parsed.data.name,
      orderIndex: parsed.data.orderIndex,
      ...(parsed.data.conversionRate !== undefined
        ? { conversionRate: parsed.data.conversionRate }
        : {}),
    });
    logger.info("funnel stage created", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      funnelStageId: stage.id,
    });
    return NextResponse.json({ stage }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DuplicateFunnelStageOrderError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("funnel stage creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to create funnel stage" }, { status: 500 });
  }
}
