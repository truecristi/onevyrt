import { NextRequest, NextResponse } from "next/server";
import {
  acceptTaskProposal,
  TaskProposalNotFoundError,
  TaskProposalNotPendingError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; proposalId: string };
}

/** A dedicated action route (same shape as the artifact-proposals accept route), not a generic status PATCH, since accepting has the real side effect of creating a task. */
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
    const proposal = await acceptTaskProposal(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      proposalId: params.proposalId,
    });
    logger.info("task proposal accepted", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      proposalId: proposal.id,
      createdTaskId: proposal.createdTaskId,
    });
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof TaskProposalNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof TaskProposalNotPendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("task proposal accept failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to accept task proposal" }, { status: 500 });
  }
}
