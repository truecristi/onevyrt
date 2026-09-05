import { NextRequest, NextResponse } from "next/server";
import { updateExperimentRequestSchema } from "@onevyrt/contracts";
import {
  updateExperiment,
  AssumptionNotFoundError,
  ExperimentNotFoundError,
  ExperimentOwnerNotInWorkspaceError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; experimentId: string };
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

  const parsed = updateExperimentRequestSchema.safeParse(await request.json().catch(() => null));
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
    const experiment = await updateExperiment(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      experimentId: params.experimentId,
      ...patch,
    });
    logger.info("experiment updated", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      experimentId: experiment.id,
    });
    return NextResponse.json({ experiment });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ExperimentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof AssumptionNotFoundError ||
      error instanceof ExperimentOwnerNotInWorkspaceError
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    logger.error("experiment update failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to update experiment" }, { status: 500 });
  }
}
