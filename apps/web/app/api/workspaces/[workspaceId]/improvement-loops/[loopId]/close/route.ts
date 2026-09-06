import { NextRequest, NextResponse } from "next/server";
import { closeImprovementLoopRequestSchema } from "@onevyrt/contracts";
import {
  closeImprovementLoop,
  ImprovementLoopAlreadyClosedError,
  ImprovementLoopNotFoundError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; loopId: string };
}

/**
 * Closes an improvement loop: re-measures the same signal it started
 * with and records whether it improved - see
 * improvement-loop-use-cases.ts's closeImprovementLoop doc comment.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = closeImprovementLoopRequestSchema.safeParse(
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
    const loop = await closeImprovementLoop(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      loopId: params.loopId,
      outcomeNote: parsed.data.outcomeNote,
    });
    return NextResponse.json({ loop });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ImprovementLoopNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ImprovementLoopAlreadyClosedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
