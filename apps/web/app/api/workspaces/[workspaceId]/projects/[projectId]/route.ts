import { NextRequest, NextResponse } from "next/server";
import { updateProjectRequestSchema } from "@onevyrt/contracts";
import { updateProject, ProjectNotFoundError } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; projectId: string };
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

  const parsed = updateProjectRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );

  try {
    const project = await updateProject(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      projectId: params.projectId,
      ...patch,
    });
    logger.info("project updated", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      projectId: project.id,
    });
    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("project update failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
