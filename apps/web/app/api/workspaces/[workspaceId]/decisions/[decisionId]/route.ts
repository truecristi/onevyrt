import { NextRequest, NextResponse } from "next/server";
import { updateDecisionRequestSchema } from "@onevyrt/contracts";
import { updateDecision, DecisionNotFoundError } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; decisionId: string };
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

  const parsed = updateDecisionRequestSchema.safeParse(await request.json().catch(() => null));
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
    const decision = await updateDecision(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      decisionId: params.decisionId,
      ...patch,
    });
    logger.info("decision updated", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      decisionId: decision.id,
    });
    return NextResponse.json({ decision });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DecisionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("decision update failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to update decision" }, { status: 500 });
  }
}
