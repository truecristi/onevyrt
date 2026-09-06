import { NextRequest, NextResponse } from "next/server";
import { updateLessonRequestSchema } from "@onevyrt/contracts";
import { updateLesson, LessonNotFoundError, ProgramVersionNotEditableError } from "@onevyrt/domain";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { programId: string; versionId: string; lessonId: string };
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

  const parsed = updateLessonRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  // exactOptionalPropertyTypes: strip keys Zod left as `undefined` (field
  // not provided) rather than spreading them, but keep `null`
  // (estimatedMinutes explicitly cleared) - same pattern as the
  // offers/business-metrics PATCH routes.
  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );

  try {
    const lesson = await updateLesson(db, {
      actorUserId: user.id,
      lessonId: params.lessonId,
      ...patch,
    });
    logger.info("lesson updated", {
      correlationId,
      userId: user.id,
      lessonId: lesson.id,
    });
    return NextResponse.json({ lesson });
  } catch (error) {
    if (error instanceof PlatformAdminRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof LessonNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ProgramVersionNotEditableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("lesson update failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 });
  }
}
