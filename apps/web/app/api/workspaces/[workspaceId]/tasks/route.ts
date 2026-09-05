import { NextRequest, NextResponse } from "next/server";
import { createTaskRequestSchema } from "@onevyrt/contracts";
import { createTask, listTasks } from "@onevyrt/domain";
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
    const tasks = await listTasks(db, { workspaceId: params.workspaceId, actorUserId: user.id });
    return NextResponse.json({ tasks });
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

  const parsed = createTaskRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const task = await createTask(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      ...(parsed.data.dueDate ? { dueDate: new Date(parsed.data.dueDate) } : {}),
    });
    logger.info("task created", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      taskId: task.id,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logger.error("task creation failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
