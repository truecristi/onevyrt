import { NextRequest, NextResponse } from "next/server";
import { createBusinessMetricRequestSchema } from "@onevyrt/contracts";
import { createBusinessMetric, listBusinessMetrics } from "@onevyrt/domain";
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
    const metrics = await listBusinessMetrics(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ metrics });
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

  const parsed = createBusinessMetricRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const metric = await createBusinessMetric(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      name: parsed.data.name,
      unit: parsed.data.unit,
      direction: parsed.data.direction,
      cadence: parsed.data.cadence,
      ...(parsed.data.baselineValue !== undefined
        ? { baselineValue: parsed.data.baselineValue }
        : {}),
      ...(parsed.data.targetValue !== undefined ? { targetValue: parsed.data.targetValue } : {}),
      ...(parsed.data.currentValue !== undefined ? { currentValue: parsed.data.currentValue } : {}),
    });
    logger.info("business metric created", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      metricId: metric.id,
    });
    return NextResponse.json({ metric }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logger.error("business metric creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to create business metric" }, { status: 500 });
  }
}
