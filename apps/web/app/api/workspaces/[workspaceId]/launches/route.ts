import { NextRequest, NextResponse } from "next/server";
import { createLaunchRequestSchema } from "@onevyrt/contracts";
import { createLaunch, listLaunches, OfferNotFoundError } from "@onevyrt/domain";
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
    const launches = await listLaunches(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ launches });
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

  const parsed = createLaunchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const launch = await createLaunch(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      name: parsed.data.name,
      notes: parsed.data.notes,
      checklist: parsed.data.checklist,
      ...(parsed.data.offerId !== undefined ? { offerId: parsed.data.offerId } : {}),
      ...(parsed.data.launchDate !== undefined
        ? { launchDate: new Date(parsed.data.launchDate) }
        : {}),
    });
    logger.info("launch created", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      launchId: launch.id,
    });
    return NextResponse.json({ launch }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof OfferNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    logger.error("launch creation failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to create launch" }, { status: 500 });
  }
}
