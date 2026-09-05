import { NextRequest, NextResponse } from "next/server";
import { updateFunnelStepRequestSchema } from "@onevyrt/contracts";
import {
  updateFunnelStep,
  deleteFunnelStep,
  FunnelStepNotFoundError,
  DuplicateFunnelStepOrderError,
  OfferNotFoundError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; funnelStepId: string };
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

  const parsed = updateFunnelStepRequestSchema.safeParse(await request.json().catch(() => null));
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
    const step = await updateFunnelStep(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      funnelStepId: params.funnelStepId,
      ...patch,
    });
    logger.info("funnel step updated", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      funnelStepId: step.id,
    });
    return NextResponse.json({ step });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof FunnelStepNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DuplicateFunnelStepOrderError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof OfferNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    logger.error("funnel step update failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to update funnel step" }, { status: 500 });
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
    await deleteFunnelStep(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      funnelStepId: params.funnelStepId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof FunnelStepNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("funnel step deletion failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to delete funnel step" }, { status: 500 });
  }
}
