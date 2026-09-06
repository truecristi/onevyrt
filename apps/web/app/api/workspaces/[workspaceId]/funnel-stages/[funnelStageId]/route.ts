import { NextRequest, NextResponse } from "next/server";
import { updateFunnelStageRequestSchema } from "@onevyrt/contracts";
import {
  updateFunnelStage,
  deleteFunnelStage,
  FunnelStageNotFoundError,
  DuplicateFunnelStageOrderError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; funnelStageId: string };
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

  const parsed = updateFunnelStageRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );

  try {
    const stage = await updateFunnelStage(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      funnelStageId: params.funnelStageId,
      ...patch,
    });
    logger.info("funnel stage updated", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      funnelStageId: stage.id,
    });
    return NextResponse.json({ stage });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof FunnelStageNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DuplicateFunnelStageOrderError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("funnel stage update failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to update funnel stage" }, { status: 500 });
  }
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
    await deleteFunnelStage(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      funnelStageId: params.funnelStageId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof FunnelStageNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("funnel stage deletion failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to delete funnel stage" }, { status: 500 });
  }
}
