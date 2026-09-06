import { NextRequest, NextResponse } from "next/server";
import { listAuditLogQuerySchema } from "@onevyrt/contracts";
import { listAuditLog } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

interface RouteParams {
  params: { workspaceId: string };
}

// Read-only: audit entries are written internally by every other
// business-core use case, never created directly through this route.
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = listAuditLogQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const entries = await listAuditLog(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
