import { NextRequest, NextResponse } from "next/server";
import { askCoachingRequestSchema } from "@onevyrt/contracts";
import { assembleWorkspaceContext, recordAiCall } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import {
  getPromptTemplate,
  runPrompt,
  selectDefaultProvider,
  createDeterministicProvider,
  AiProviderError,
  AiRateLimitExceededError,
  PromptOutputValidationError,
  DEFAULT_ANTHROPIC_MODEL,
  type AiProvider,
  type CoachingAskOutput,
} from "@onevyrt/ai";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * selectDefaultProvider() falls back to the deterministic adapter with no
 * ANTHROPIC_API_KEY, but that adapter echoes plain text, which isn't the
 * JSON envelope coaching_ask's schema requires - so a keyless deployment
 * would 502 here. Rather than leave coaching dead without a key, this
 * returns a deterministic provider whose response is a *labeled placeholder*
 * answer: the ask -> answer flow stays exercisable (sandbox, CI, any keyless
 * install), the answer states plainly it's a placeholder and how to get real
 * coaching, and recordAiCall still attributes it to "deterministic" - never a
 * silent stand-in for a real model. With a key set, the real Anthropic
 * adapter is used untouched.
 */
function resolveCoachProvider(question: string): AiProvider {
  const provider = selectDefaultProvider();
  if (provider.id !== "deterministic") {
    return provider;
  }
  return createDeterministicProvider({
    respond: () =>
      JSON.stringify({
        answer:
          `Placeholder response - no AI provider is configured, so this isn't real ` +
          `coaching yet. You asked: "${question}". Set ANTHROPIC_API_KEY to get an ` +
          `answer grounded in this workspace's profile, goals, assumptions and decisions.`,
        followUpQuestion: null,
      }),
  });
}

/**
 * PRD-AI-004: the coaching interface (README "AI coaching" -> "Coaching
 * interface", fourth slice of Phase 6). Glues together three already
 * independently-shipped pieces - assembleWorkspaceContext (packages/
 * domain, Phase 6 third slice), the gateway/prompt registry (packages/ai,
 * first two slices) - at the one place that's allowed to know about all
 * three: the API route. Lesson explanations, artifact/task proposals and
 * sketch specifications are separate, later slices with their own routes.
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

  const parsed = askCoachingRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const context = await assembleWorkspaceContext(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      contextClasses: ["business_profile", "goals", "assumptions", "decisions"],
    });

    const template = getPromptTemplate<CoachingAskOutput>("coaching_ask", 1);
    if (!template) {
      throw new Error("coaching_ask prompt template is not registered");
    }

    const provider = resolveCoachProvider(parsed.data.question);
    const { output, completion } = await runPrompt(
      provider,
      template,
      { context: context.text, question: parsed.data.question },
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

    logger.info("coaching question answered", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      providerId: provider.id,
    });

    return NextResponse.json({
      answer: output.answer,
      followUpQuestion: output.followUpQuestion,
      contextManifest: context.manifest,
    });
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
      logger.error("coaching question failed upstream", {
        correlationId,
        error: error.message,
      });
      return NextResponse.json(
        { error: "AI provider did not return a usable answer" },
        {
          status: 502,
        },
      );
    }
    logger.error("coaching question failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to answer coaching question" }, { status: 500 });
  }
}
