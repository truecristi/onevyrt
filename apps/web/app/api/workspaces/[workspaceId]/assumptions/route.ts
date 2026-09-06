import { NextRequest, NextResponse } from "next/server";
import { createAssumptionRequestSchema } from "@onevyrt/contracts";
import {
  createAssumption,
  listAssumptions,
  AssumptionOwnerNotInWorkspaceError,
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
    const assumptions = await listAssumptions(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ assumptions });
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

  const parsed = createAssumptionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const assumption = await createAssumption(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      statement: parsed.data.statement,
      description: parsed.data.description,
      source: parsed.data.source,
      confidence: parsed.data.confidence,
      unit: parsed.data.unit,
      sourceType: parsed.data.sourceType,
      ...(parsed.data.value !== undefined ? { value: parsed.data.value } : {}),
      ...(parsed.data.sourceDate !== undefined ? { sourceDate: parsed.data.sourceDate } : {}),
      ...(parsed.data.ownerId !== undefined ? { ownerId: parsed.data.ownerId } : {}),
      ...(parsed.data.formulaTraceKey !== undefined
        ? { formulaTraceKey: parsed.data.formulaTraceKey }
        : {}),
      ...(parsed.data.formulaTraceVersion !== undefined
        ? { formulaTraceVersion: parsed.data.formulaTraceVersion }
        : {}),
    });
    logger.info("assumption created", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      assumptionId: assumption.id,
    });
    return NextResponse.json({ assumption }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof AssumptionOwnerNotInWorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    logger.error("assumption creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to create assumption" }, { status: 500 });
  }
}
