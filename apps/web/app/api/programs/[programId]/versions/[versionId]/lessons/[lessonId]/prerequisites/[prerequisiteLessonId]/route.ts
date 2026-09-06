import { NextRequest, NextResponse } from "next/server";
import {
  removePrerequisite,
  LessonNotFoundError,
  PrerequisiteNotFoundError,
  ProgramVersionNotEditableError,
} from "@onevyrt/domain";
import { PlatformAdminRequiredError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { programId: string; versionId: string; lessonId: string; prerequisiteLessonId: string };
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { db } = getServerContext();

  try {
    await removePrerequisite(db, {
      actorUserId: user.id,
      lessonId: params.lessonId,
      prerequisiteLessonId: params.prerequisiteLessonId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof PlatformAdminRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof LessonNotFoundError || error instanceof PrerequisiteNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ProgramVersionNotEditableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("prerequisite removal failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to remove prerequisite" }, { status: 500 });
  }
}
