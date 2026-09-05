import { NextRequest, NextResponse } from "next/server";
import { updateEvidenceRequestSchema } from "@onevyrt/contracts";
import {
  updateEvidence,
  AssumptionNotFoundError,
  DecisionNotFoundError,
  EvidenceNotFoundError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; evidenceId: string };
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

  const parsed = updateEvidenceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  const { collectedAt, ...rest } = parsed.data;
  const patch: Record<string, unknown> = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );
  if (collectedAt !== undefined) {
    patch.collectedAt = collectedAt === null ? null : new Date(collectedAt);
  }

  try {
    const item = await updateEvidence(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      evidenceId: params.evidenceId,
      ...patch,
    });
    logger.info("evidence updated", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      evidenceId: item.id,
    });
    return NextResponse.json({ evidence: item });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof EvidenceNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    // 400, not 404: the missing resource here is a field inside this
    // request's own body (assumptionId/decisionId), not the URL's
    // resource, so it reads as an invalid request rather than "not found".
    if (error instanceof AssumptionNotFoundError || error instanceof DecisionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error("evidence update failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to update evidence" }, { status: 500 });
  }
}
