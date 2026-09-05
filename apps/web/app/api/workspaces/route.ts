import { NextRequest, NextResponse } from "next/server";
import { createWorkspaceRequestSchema } from "@onevyrt/contracts";
import { createWorkspace, listWorkspacesForUser } from "@onevyrt/domain";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();
  const workspaces = await listWorkspacesForUser(db, user.id);
  return NextResponse.json({ workspaces });
}

export async function POST(request: NextRequest) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = createWorkspaceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();
  const workspace = await createWorkspace(db, { ownerUserId: user.id, name: parsed.data.name });
  logger.info("workspace created", { correlationId, userId: user.id, workspaceId: workspace.id });

  return NextResponse.json({ workspace }, { status: 201 });
}
