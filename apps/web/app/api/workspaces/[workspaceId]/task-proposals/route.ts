import { NextRequest, NextResponse } from "next/server";
import { createTaskProposalRequestSchema } from "@onevyrt/contracts";
import {
  assembleWorkspaceContext,
  createTaskProposal,
  listTaskProposals,
  recordAiCall,
  InvalidTaskProposalError,
} from "@onevyrt/domain";
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
  type ProposeTaskOutput,
} from "@onevyrt/ai";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * selectDefaultProvider() falls back to the deterministic adapter when no
 * ANTHROPIC_API_KEY is configured, but that adapter's default output is a
 * plain echo, which isn't the JSON envelope propose_task's outputSchema
 * requires - so a keyless deployment would always 502 here. Rather than
 * leave the feature dead without a key, this returns a deterministic
 * provider whose response is a *labeled placeholder* proposal built from
 * the user's own instruction: the whole propose -> review -> accept flow
 * stays exercisable (sandbox, CI, and any keyless install), the rationale
 * says plainly it's a placeholder and how to get real proposals, and
 * recordAiCall still attributes it to the "deterministic" provider - never
 * a silent stand-in for a real model. With a key set, the real Anthropic
 * adapter is used untouched.
 */
function resolveProposalProvider(instruction: string): AiProvider {
  const provider = selectDefaultProvider();
  if (provider.id !== "deterministic") {
    return provider;
  }
  return createDeterministicProvider({
    respond: () =>
      JSON.stringify({
        task: {
          title: instruction.slice(0, 200),
          description: "",
          priority: "medium",
        },
        rationale:
          "Placeholder proposal echoed from your instruction because no AI " +
          "provider is configured. Set ANTHROPIC_API_KEY to get proposals " +
          "grounded in your workspace context.",
      }),
  });
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const proposals = await listTaskProposals(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ proposals });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}

/**
 * PRD-AI-007: proposes a new task grounded in the workspace's current
 * business context (README "AI coaching" -> "Task proposals", seventh
 * slice of Phase 6). Assembles the same default context classes as the
 * coaching interface route, asks the model for a task plus a rationale,
 * then stores it as a pending proposal - createTaskProposal validates the
 * task a second time before it's ever persisted. Nothing is created yet;
 * see .../accept and .../reject.
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

  const parsed = createTaskProposalRequestSchema.safeParse(await request.json().catch(() => null));
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

    const template = getPromptTemplate<ProposeTaskOutput>("propose_task", 1);
    if (!template) {
      throw new Error("propose_task prompt template is not registered");
    }

    const provider = resolveProposalProvider(parsed.data.instruction);
    const { output, completion } = await runPrompt(
      provider,
      template,
      { context: context.text, instruction: parsed.data.instruction },
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

    const proposal = await createTaskProposal(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      proposedTask: output.task,
      rationale: output.rationale,
      promptTemplateKey: template.key,
      promptTemplateVersion: template.version,
      providerId: provider.id,
      model: DEFAULT_ANTHROPIC_MODEL,
    });

    logger.info("task proposal created", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      proposalId: proposal.id,
      providerId: provider.id,
    });

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof InvalidTaskProposalError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
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
      logger.error("task proposal failed upstream", { correlationId, error: error.message });
      return NextResponse.json(
        { error: "AI provider did not return a usable proposal" },
        { status: 502 },
      );
    }
    logger.error("task proposal creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to create task proposal" }, { status: 500 });
  }
}
