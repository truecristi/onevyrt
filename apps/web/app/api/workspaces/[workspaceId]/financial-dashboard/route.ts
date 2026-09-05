import { NextRequest, NextResponse } from "next/server";
import { getFinancialDashboard } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

interface RouteParams {
  params: { workspaceId: string };
}

// Read-only aggregation - one round trip instead of five separate list
// calls. See getFinancialDashboard's doc comment: not a new source of
// truth, just a consolidated view over existing data.
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const dashboard = await getFinancialDashboard(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ dashboard });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
