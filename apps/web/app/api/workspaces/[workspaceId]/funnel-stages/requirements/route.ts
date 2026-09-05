import { NextRequest, NextResponse } from "next/server";
import { calculateFunnelRequirementsRequestSchema } from "@onevyrt/contracts";
import {
  calculateFunnelRequirements,
  FunnelHasNoStagesError,
  MissingConversionRateError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string };
}

// A dedicated computation route, same reasoning as /api/formulas/by-key/[key]/compute:
// this isn't a stored resource, it's a derived answer over the workspace's
// current funnel stages.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = calculateFunnelRequirementsRequestSchema.safeParse(
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
    const requirements = await calculateFunnelRequirements(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      targetAtFinalStage: parsed.data.targetAtFinalStage,
    });
    return NextResponse.json({ requirements });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof FunnelHasNoStagesError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof MissingConversionRateError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
