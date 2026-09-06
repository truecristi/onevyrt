import { NextRequest, NextResponse } from "next/server";
import { createLessonRequestSchema } from "@onevyrt/contracts";
import {
  createLesson,
  listLessons,
  ProgramVersionNotFoundError,
  ProgramVersionNotEditableError,
  DuplicateLessonSlugError,
} from "@onevyrt/domain";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { programId: string; versionId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const lessons = await listLessons(db, {
      actorUserId: user.id,
      programVersionId: params.versionId,
    });
    return NextResponse.json({ lessons });
  } catch (error) {
    if (error instanceof ProgramVersionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
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

  const parsed = createLessonRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const lesson = await createLesson(db, {
      actorUserId: user.id,
      programVersionId: params.versionId,
      slug: parsed.data.slug,
      title: parsed.data.title,
      outcome: parsed.data.outcome,
      orderIndex: parsed.data.orderIndex,
      ...(parsed.data.estimatedMinutes !== undefined
        ? { estimatedMinutes: parsed.data.estimatedMinutes }
        : {}),
    });
    logger.info("lesson created", {
      correlationId,
      userId: user.id,
      programVersionId: params.versionId,
      lessonId: lesson.id,
    });
    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    if (error instanceof PlatformAdminRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ProgramVersionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ProgramVersionNotEditableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof DuplicateLessonSlugError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("lesson creation failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }
}
