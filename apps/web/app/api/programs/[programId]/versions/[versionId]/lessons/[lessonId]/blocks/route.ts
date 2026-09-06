import { NextRequest, NextResponse } from "next/server";
import { createLessonBlockRequestSchema } from "@onevyrt/contracts";
import {
  createLessonBlock,
  listLessonBlocks,
  LessonNotFoundError,
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
    const blocks = await listLessonBlocks(db, {
      actorUserId: user.id,
      lessonId: params.lessonId,
    });
    return NextResponse.json({ blocks });
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

  const parsed = createLessonBlockRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const block = await createLessonBlock(db, {
      actorUserId: user.id,
      lessonId: params.lessonId,
      orderIndex: parsed.data.orderIndex,
      blockType: parsed.data.blockType,
      payload: parsed.data.payload,
    });
    logger.info("lesson block created", {
      correlationId,
      userId: user.id,
      lessonId: params.lessonId,
      blockId: block.id,
      blockType: block.blockType,
    });
    return NextResponse.json({ block }, { status: 201 });
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
    logger.error("lesson block creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to create lesson block" }, { status: 500 });
  }
}
