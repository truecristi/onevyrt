import { NextRequest, NextResponse } from "next/server";
import {
  acceptArtifactProposal,
  ArtifactProposalNotFoundError,
  ArtifactProposalNotPendingError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; proposalId: string };
}

/** The "audited-apply" half of §7.2's pipeline - a dedicated action route (same shape as program-version publish), not a generic status PATCH, since accepting has the real side effect of mutating the target artifact. */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const proposal = await acceptArtifactProposal(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      proposalId: params.proposalId,
    });
    logger.info("artifact proposal accepted", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      proposalId: proposal.id,
    });
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ArtifactProposalNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ArtifactProposalNotPendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("artifact proposal accept failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to accept artifact proposal" }, { status: 500 });
  }
}
