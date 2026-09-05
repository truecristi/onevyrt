import { NextRequest, NextResponse } from "next/server";
import { addPrerequisiteRequestSchema } from "@onevyrt/contracts";
import {
  addPrerequisite,
  listPrerequisitesForLesson,
  LessonNotFoundError,
  SelfPrerequisiteError,
  PrerequisiteNotInSameVersionError,
  DuplicatePrerequisiteError,
  ProgramVersionNotEditableError,
} from "@onevyrt/domain";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { programId: string; versionId: string; lessonId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const prerequisites = await listPrerequisitesForLesson(db, {
      actorUserId: user.id,
      lessonId: params.lessonId,
    });
    return NextResponse.json({ prerequisites });
  } catch (error) {
    if (error instanceof LessonNotFoundError) {
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

  const parsed = addPrerequisiteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const prerequisite = await addPrerequisite(db, {
      actorUserId: user.id,
      lessonId: params.lessonId,
      prerequisiteLessonId: parsed.data.prerequisiteLessonId,
    });
    logger.info("prerequisite added", {
      correlationId,
      userId: user.id,
      lessonId: params.lessonId,
      prerequisiteLessonId: parsed.data.prerequisiteLessonId,
    });
    return NextResponse.json({ prerequisite }, { status: 201 });
  } catch (error) {
    if (error instanceof PlatformAdminRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof LessonNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof SelfPrerequisiteError ||
      error instanceof PrerequisiteNotInSameVersionError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error instanceof DuplicatePrerequisiteError ||
      error instanceof ProgramVersionNotEditableError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("prerequisite creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to add prerequisite" }, { status: 500 });
  }
}
