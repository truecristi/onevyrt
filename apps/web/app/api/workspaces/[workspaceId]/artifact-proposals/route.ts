import { NextRequest, NextResponse } from "next/server";
import { createArtifactProposalRequestSchema } from "@onevyrt/contracts";
import {
  getArtifactForProposal,
  createArtifactProposal,
  listArtifactProposals,
  ArtifactNotFoundError,
  InvalidArtifactProposalPatchError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import {
  getPromptTemplate,
  runPrompt,
  selectDefaultProvider,
  AiProviderError,
  PromptOutputValidationError,
  DEFAULT_ANTHROPIC_MODEL,
  type ProposeArtifactPatchOutput,
} from "@onevyrt/ai";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const proposals = await listArtifactProposals(db, {
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
 * PRD-AI-006: proposes a change to an existing artifact (README
 * "AI coaching" -> "Artifact proposals", sixth slice of Phase 6). Loads
 * the artifact's current state, asks the model for a targeted patch plus
 * a rationale, then stores it as a pending proposal - the patch is
 * validated a second time inside createArtifactProposal against that
 * artifact type's own update-request schema before it's ever persisted.
 * Nothing is applied yet; see .../accept and .../reject.
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

  const parsed = createArtifactProposalRequestSchema.safeParse(
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
    const currentState = await getArtifactForProposal(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      artifactType: parsed.data.artifactType,
      artifactId: parsed.data.artifactId,
    });

    const template = getPromptTemplate<ProposeArtifactPatchOutput>("propose_artifact_patch", 1);
    if (!template) {
      throw new Error("propose_artifact_patch prompt template is not registered");
    }

    const provider = selectDefaultProvider();
    const { output } = await runPrompt(
      provider,
      template,
      {
        artifactType: parsed.data.artifactType,
        currentState: JSON.stringify(currentState),
        instruction: parsed.data.instruction,
      },
      { model: DEFAULT_ANTHROPIC_MODEL },
    );

    const proposal = await createArtifactProposal(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      artifactType: parsed.data.artifactType,
      artifactId: parsed.data.artifactId,
      proposedPatch: output.patch,
      rationale: output.rationale,
      promptTemplateKey: template.key,
      promptTemplateVersion: template.version,
      providerId: provider.id,
      model: DEFAULT_ANTHROPIC_MODEL,
    });

    logger.info("artifact proposal created", {
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
    if (error instanceof ArtifactNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidArtifactProposalPatchError) {
      // The model's own output is what failed validation here, not the
      // caller's request body - still a 422, not a 500, since retrying
      // the same instruction may well succeed.
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof PromptOutputValidationError || error instanceof AiProviderError) {
      logger.error("artifact proposal failed upstream", { correlationId, error: error.message });
      return NextResponse.json(
        { error: "AI provider did not return a usable proposal" },
        { status: 502 },
      );
    }
    logger.error("artifact proposal creation failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to create artifact proposal" }, { status: 500 });
  }
}
