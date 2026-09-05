import { NextRequest, NextResponse } from "next/server";
import { updateBusinessMetricRequestSchema } from "@onevyrt/contracts";
import { updateBusinessMetric, BusinessMetricNotFoundError } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; metricId: string };
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

  const parsed = updateBusinessMetricRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  // Same undefined-stripping as the offers PATCH route - but `null` must
  // survive this filter (it means "clear this value"), only `undefined`
  // (an omitted field) is dropped.
  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );

  try {
    const metric = await updateBusinessMetric(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      metricId: params.metricId,
      ...patch,
    });
    logger.info("business metric updated", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      metricId: metric.id,
    });
    return NextResponse.json({ metric });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof BusinessMetricNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("business metric update failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to update business metric" }, { status: 500 });
  }
}
