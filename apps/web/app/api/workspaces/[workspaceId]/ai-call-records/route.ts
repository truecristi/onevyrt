import { NextRequest, NextResponse } from "next/server";
import { listAiCallRecords } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * PRD-AI-010: cost and latency tracking (README "AI coaching" -> "Cost
 * and latency tracking", tenth slice of Phase 6). Read-only - these rows
 * are written internally by each AI route via recordAiCall, never by a
 * client request.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const records = await listAiCallRecords(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ records });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
