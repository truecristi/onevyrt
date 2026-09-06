import { NextRequest, NextResponse } from "next/server";
import { startImprovementLoopRequestSchema } from "@onevyrt/contracts";
import { listImprovementLoops, startImprovementLoop, TaskNotFoundError } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * PRD-REVIEW-007: improvement loops (README "Review and intelligence"
 * -> "Improvement loops", seventh and final slice of Phase 7). Lists
 * every loop, newest first. See .../[loopId]/close for closing one.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const loops = await listImprovementLoops(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ loops });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}

/**
 * Starts tracking one of .../recommendations' entries: snapshots its
 * source/relatedId/title/rationale plus a baseline measurement of
 * whatever that source signals, optionally linked to a real task.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = startImprovementLoopRequestSchema.safeParse(
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
    const loop = await startImprovementLoop(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      source: parsed.data.source,
      relatedId: parsed.data.relatedId,
      title: parsed.data.title,
      rationale: parsed.data.rationale,
      ...(parsed.data.taskId !== undefined ? { taskId: parsed.data.taskId } : {}),
    });
    return NextResponse.json({ loop }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
