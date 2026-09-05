import { NextRequest, NextResponse } from "next/server";
import { createEvidenceRequestSchema } from "@onevyrt/contracts";
import {
  createEvidence,
  listEvidence,
  AssumptionNotFoundError,
  DecisionNotFoundError,
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
    const evidence = await listEvidence(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ evidence });
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

  const parsed = createEvidenceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const item = await createEvidence(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      sourceUrl: parsed.data.sourceUrl,
      strength: parsed.data.strength,
      ...(parsed.data.assumptionId !== undefined ? { assumptionId: parsed.data.assumptionId } : {}),
      ...(parsed.data.decisionId !== undefined ? { decisionId: parsed.data.decisionId } : {}),
      ...(parsed.data.collectedAt !== undefined
        ? { collectedAt: new Date(parsed.data.collectedAt) }
        : {}),
    });
    logger.info("evidence created", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      evidenceId: item.id,
    });
    return NextResponse.json({ evidence: item }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    // 400, not 404: the missing resource here is a field inside this
    // request's own body (assumptionId/decisionId), not the URL's
    // resource, so it reads as an invalid request rather than "not found".
    if (error instanceof AssumptionNotFoundError || error instanceof DecisionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error("evidence creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to create evidence" }, { status: 500 });
  }
}
