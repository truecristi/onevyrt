import { NextRequest, NextResponse } from "next/server";
import { submitLessonApplicationRequestSchema } from "@onevyrt/contracts";
import {
  submitLessonApplication,
  EnrollmentNotFoundError,
  LessonNotFoundError,
  LessonBlockNotFoundError,
  BlockTypeMismatchError,
  LessonApplicationResourceNotFoundError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { enrollmentId: string; lessonBlockId: string };
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

  const parsed = submitLessonApplicationRequestSchema.safeParse(
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
    const application = await submitLessonApplication(db, {
      actorUserId: user.id,
      enrollmentId: params.enrollmentId,
      lessonBlockId: params.lessonBlockId,
      workspaceId: parsed.data.workspaceId,
      resourceType: parsed.data.resourceType,
      resourceId: parsed.data.resourceId,
      note: parsed.data.note,
    });
    logger.info("lesson application submitted", {
      correlationId,
      userId: user.id,
      enrollmentId: params.enrollmentId,
      lessonBlockId: params.lessonBlockId,
      resourceType: parsed.data.resourceType,
    });
    return NextResponse.json({ application });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (
      error instanceof EnrollmentNotFoundError ||
      error instanceof LessonNotFoundError ||
      error instanceof LessonBlockNotFoundError ||
      error instanceof LessonApplicationResourceNotFoundError
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BlockTypeMismatchError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error("lesson application submission failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to submit lesson application" }, { status: 500 });
  }
}
