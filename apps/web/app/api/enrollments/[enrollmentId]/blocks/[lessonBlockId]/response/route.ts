import { NextRequest, NextResponse } from "next/server";
import { submitBlockResponseRequestSchema } from "@onevyrt/contracts";
import {
  submitKnowledgeCheckResponse,
  submitReflectionResponse,
  EnrollmentNotFoundError,
  LessonNotFoundError,
  LessonBlockNotFoundError,
  BlockTypeMismatchError,
} from "@onevyrt/domain";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { enrollmentId: string; lessonBlockId: string };
}

// One route dispatching to either submit function based on the
// discriminated union's blockType, rather than two separate routes -
// the caller doesn't know or care which block type it is until it reads
// the block; the block itself is the source of truth, checked
// server-side either way (BlockTypeMismatchError if it's wrong).
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = submitBlockResponseRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const response =
      parsed.data.blockType === "knowledge-check"
        ? await submitKnowledgeCheckResponse(db, {
            actorUserId: user.id,
            enrollmentId: params.enrollmentId,
            lessonBlockId: params.lessonBlockId,
            selectedOptionIndex: parsed.data.response.selectedOptionIndex,
          })
        : await submitReflectionResponse(db, {
            actorUserId: user.id,
            enrollmentId: params.enrollmentId,
            lessonBlockId: params.lessonBlockId,
            text: parsed.data.response.text,
            ...(parsed.data.response.confidenceRating !== undefined
              ? { confidenceRating: parsed.data.response.confidenceRating }
              : {}),
          });
    logger.info("block response submitted", {
      correlationId,
      userId: user.id,
      enrollmentId: params.enrollmentId,
      lessonBlockId: params.lessonBlockId,
      blockType: parsed.data.blockType,
    });
    return NextResponse.json({ response });
  } catch (error) {
    if (
      error instanceof EnrollmentNotFoundError ||
      error instanceof LessonNotFoundError ||
      error instanceof LessonBlockNotFoundError
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BlockTypeMismatchError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error("block response submission failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to submit response" }, { status: 500 });
  }
}
