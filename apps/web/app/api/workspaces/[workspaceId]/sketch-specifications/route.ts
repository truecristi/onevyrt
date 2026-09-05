import { NextRequest, NextResponse } from "next/server";
import { proposeSketchSpecificationRequestSchema } from "@onevyrt/contracts";
import { requireWorkspaceMembership, recordAiCall } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import {
  getPromptTemplate,
  runPrompt,
  selectDefaultProvider,
  AiProviderError,
  AiRateLimitExceededError,
  PromptOutputValidationError,
  DEFAULT_ANTHROPIC_MODEL,
  type InterpretSketchOutput,
} from "@onevyrt/ai";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * PRD-AI-008: sketch specifications (README "AI coaching" -> "Sketch
 * specifications", eighth slice of Phase 6; spec §4.4/§28's
 * SketchInterpretation - "no mutation"). Unlike every other AI route in
 * this codebase, this one creates no artifact, task or proposal - it
 * only returns an interpretation of the sketch description the caller
 * sent. It still records an AI call (recordAiCall, tenth slice) for
 * cost/latency tracking, the same as every other AI-touching route -
 * "no mutation" means no business-data side effect, not "off the books."
 * Workspace membership is still required, since a sketch's content can
 * describe confidential business context even though nothing about the
 * sketch itself is persisted here.
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

  const parsed = proposeSketchSpecificationRequestSchema.safeParse(
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
    await requireWorkspaceMembership(db, params.workspaceId, user.id);

    const template = getPromptTemplate<InterpretSketchOutput>("interpret_sketch", 1);
    if (!template) {
      throw new Error("interpret_sketch prompt template is not registered");
    }

    const provider = selectDefaultProvider();
    const { output, completion } = await runPrompt(
      provider,
      template,
      { description: parsed.data.description },
      { model: DEFAULT_ANTHROPIC_MODEL, rateLimitKey: `ai:${user.id}` },
    );

    await recordAiCall(db, {
      actorUserId: user.id,
      workspaceId: params.workspaceId,
      promptTemplateKey: template.key,
      promptTemplateVersion: template.version,
      providerId: completion.providerId,
      model: completion.model,
      inputTokens: completion.usage.inputTokens,
      outputTokens: completion.usage.outputTokens,
      latencyMs: completion.latencyMs,
    });

    logger.info("sketch specification interpreted", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      providerId: provider.id,
    });

    return NextResponse.json({ specification: output });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof AiRateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many AI requests. Try again later." },
        {
          status: 429,
        },
      );
    }
    if (error instanceof PromptOutputValidationError || error instanceof AiProviderError) {
      logger.error("sketch specification failed upstream", {
        correlationId,
        error: error.message,
      });
      return NextResponse.json(
        { error: "AI provider did not return a usable interpretation" },
        { status: 502 },
      );
    }
    logger.error("sketch specification failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to interpret sketch" }, { status: 500 });
  }
}
