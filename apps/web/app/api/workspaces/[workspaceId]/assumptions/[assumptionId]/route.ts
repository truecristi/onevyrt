import { NextRequest, NextResponse } from "next/server";
import { updateAssumptionRequestSchema } from "@onevyrt/contracts";
import {
  updateAssumption,
  AssumptionNotFoundError,
  AssumptionOwnerNotInWorkspaceError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; assumptionId: string };
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

  const parsed = updateAssumptionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  // Same undefined-stripping as the business-metrics PATCH route - but
  // `null` must survive this filter (it means "clear this value"), only
  // `undefined` (an omitted field) is dropped.
  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );

  try {
    const assumption = await updateAssumption(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      assumptionId: params.assumptionId,
      ...patch,
    });
    logger.info("assumption updated", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      assumptionId: assumption.id,
    });
    return NextResponse.json({ assumption });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof AssumptionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AssumptionOwnerNotInWorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    logger.error("assumption update failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to update assumption" }, { status: 500 });
  }
}
