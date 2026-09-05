import { NextRequest, NextResponse } from "next/server";
import { createEnrollmentRequestSchema } from "@onevyrt/contracts";
import {
  enroll,
  listMyEnrollments,
  ProgramVersionNotFoundError,
  AlreadyEnrolledError,
} from "@onevyrt/domain";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

// Not workspace-scoped: enrollments belong to the individual learner's
// own account (see the doc comment on schema.ts's enrollments table).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();
  const enrollments = await listMyEnrollments(db, { actorUserId: user.id });
  return NextResponse.json({ enrollments });
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

  const parsed = createEnrollmentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const enrollment = await enroll(db, {
      actorUserId: user.id,
      programVersionId: parsed.data.programVersionId,
    });
    logger.info("enrollment created", {
      correlationId,
      userId: user.id,
      enrollmentId: enrollment.id,
    });
    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    if (error instanceof ProgramVersionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AlreadyEnrolledError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("enrollment creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to create enrollment" }, { status: 500 });
  }
}
