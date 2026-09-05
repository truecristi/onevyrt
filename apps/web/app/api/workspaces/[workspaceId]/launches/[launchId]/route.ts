import { NextRequest, NextResponse } from "next/server";
import { updateLaunchRequestSchema } from "@onevyrt/contracts";
import { updateLaunch, LaunchNotFoundError, OfferNotFoundError } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; launchId: string };
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

  const parsed = updateLaunchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  const { launchDate, ...rest } = parsed.data;
  const patch: Record<string, unknown> = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );
  if (launchDate !== undefined) {
    patch.launchDate = launchDate === null ? null : new Date(launchDate);
  }

  try {
    const launch = await updateLaunch(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      launchId: params.launchId,
      ...patch,
    });
    logger.info("launch updated", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      launchId: launch.id,
    });
    return NextResponse.json({ launch });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof LaunchNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof OfferNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    logger.error("launch update failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to update launch" }, { status: 500 });
  }
}
