import { NextRequest, NextResponse } from "next/server";
import { updateLessonProgressRequestSchema } from "@onevyrt/contracts";
import {
  startOrResumeLesson,
  updateLessonProgress,
  EnrollmentNotFoundError,
  LessonNotFoundError,
  LessonBlockNotFoundError,
  LessonProgressNotFoundError,
  PrerequisitesNotMetError,
  LessonCompletionRequirementsNotMetError,
} from "@onevyrt/domain";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { enrollmentId: string; lessonId: string };
}

// GET is the resume entry point: idempotent (see
// startOrResumeLesson's doc comment), safe to call on every lesson open.
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const progress = await startOrResumeLesson(db, {
      actorUserId: user.id,
      enrollmentId: params.enrollmentId,
      lessonId: params.lessonId,
    });
    return NextResponse.json({ progress });
  } catch (error) {
    if (error instanceof EnrollmentNotFoundError || error instanceof LessonNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PrerequisitesNotMetError) {
      return NextResponse.json(
        { error: error.message, incompleteLessonIds: error.incompleteLessonIds },
        { status: 409 },
      );
    }
    throw error;
  }
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

  const parsed = updateLessonProgressRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
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
    const progress = await updateLessonProgress(db, {
      actorUserId: user.id,
      enrollmentId: params.enrollmentId,
      lessonId: params.lessonId,
      ...patch,
    });
    logger.info("lesson progress updated", {
      correlationId,
      userId: user.id,
      enrollmentId: params.enrollmentId,
      lessonId: params.lessonId,
    });
    return NextResponse.json({ progress });
  } catch (error) {
    if (error instanceof EnrollmentNotFoundError || error instanceof LessonNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof LessonBlockNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof LessonProgressNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof LessonCompletionRequirementsNotMetError) {
      return NextResponse.json({ error: error.message, missing: error.missing }, { status: 409 });
    }
    logger.error("lesson progress update failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to update lesson progress" }, { status: 500 });
  }
}
