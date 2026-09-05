import { NextRequest, NextResponse } from "next/server";
import {
  assembleLessonExplanationContext,
  EnrollmentNotFoundError,
  LessonNotFoundError,
  LessonBlockNotFoundError,
} from "@onevyrt/domain";
import {
  getPromptTemplate,
  runPrompt,
  selectDefaultProvider,
  AiProviderError,
  PromptOutputValidationError,
  DEFAULT_ANTHROPIC_MODEL,
  type ExplainCalculationOutput,
} from "@onevyrt/ai";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { enrollmentId: string; lessonBlockId: string };
}

/**
 * PRD-AI-005: lesson explanations (README "AI coaching" -> "Lesson
 * explanations", fifth slice of Phase 6). No request body - the block and
 * enrollment named in the path are the whole input; there's nothing else
 * for the caller to configure yet.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const context = await assembleLessonExplanationContext(db, {
      actorUserId: user.id,
      enrollmentId: params.enrollmentId,
      lessonBlockId: params.lessonBlockId,
    });

    const template = getPromptTemplate<ExplainCalculationOutput>("explain_lesson_block", 1);
    if (!template) {
      throw new Error("explain_lesson_block prompt template is not registered");
    }

    const provider = selectDefaultProvider();
    const { output } = await runPrompt(
      provider,
      template,
      {
        lessonTitle: context.lessonTitle,
        blockType: context.blockType,
        content: context.content,
      },
      { model: DEFAULT_ANTHROPIC_MODEL },
    );

    logger.info("lesson block explained", {
      correlationId,
      userId: user.id,
      enrollmentId: params.enrollmentId,
      lessonBlockId: params.lessonBlockId,
      providerId: provider.id,
    });

    return NextResponse.json({
      explanation: output.explanation,
      keyTakeaway: output.keyTakeaway,
    });
  } catch (error) {
    if (
      error instanceof EnrollmentNotFoundError ||
      error instanceof LessonNotFoundError ||
      error instanceof LessonBlockNotFoundError
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PromptOutputValidationError || error instanceof AiProviderError) {
      logger.error("lesson block explanation failed upstream", {
        correlationId,
        error: error.message,
      });
      return NextResponse.json(
        { error: "AI provider did not return a usable explanation" },
        { status: 502 },
      );
    }
    logger.error("lesson block explanation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to explain lesson block" }, { status: 500 });
  }
}
