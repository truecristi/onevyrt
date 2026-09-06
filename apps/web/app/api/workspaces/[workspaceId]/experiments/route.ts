import { NextRequest, NextResponse } from "next/server";
import { createExperimentRequestSchema } from "@onevyrt/contracts";
import {
  createExperiment,
  listExperiments,
  AssumptionNotFoundError,
  ExperimentOwnerNotInWorkspaceError,
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
    const experiments = await listExperiments(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ experiments });
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

  const parsed = createExperimentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const experiment = await createExperiment(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      name: parsed.data.name,
      hypothesis: parsed.data.hypothesis,
      method: parsed.data.method,
      ...(parsed.data.assumptionId !== undefined ? { assumptionId: parsed.data.assumptionId } : {}),
      ...(parsed.data.ownerId !== undefined ? { ownerId: parsed.data.ownerId } : {}),
    });
    logger.info("experiment created", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      experimentId: experiment.id,
    });
    return NextResponse.json({ experiment }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (
      error instanceof AssumptionNotFoundError ||
      error instanceof ExperimentOwnerNotInWorkspaceError
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    logger.error("experiment creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to create experiment" }, { status: 500 });
  }
}
