import { NextRequest, NextResponse } from "next/server";
import { upsertForceAssessmentRequestSchema } from "@onevyrt/contracts";
import { listForceAssessments, upsertForceAssessment } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * PRD-REVIEW-004: force assessments (README "Review and intelligence" ->
 * "Constraint diagnosis", fourth slice of Phase 7; spec section 6.4's
 * "Diagnostic and Seven Forces"). Lists every force this workspace has
 * assessed so far - see .../constraint-diagnosis for the derived
 * weakest-force analysis over all seven forces, assessed or not.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const assessments = await listForceAssessments(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
    });
    return NextResponse.json({ assessments });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}

/** Upserts the assessment for one force - one row per workspace per force (see upsertForceAssessment's doc comment). */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = upsertForceAssessmentRequestSchema.safeParse(
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
    const assessment = await upsertForceAssessment(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      force: parsed.data.force,
      score: parsed.data.score,
      ...(parsed.data.target !== undefined ? { target: parsed.data.target } : {}),
      confidence: parsed.data.confidence,
      evidence: parsed.data.evidence,
      constraintNote: parsed.data.constraintNote,
      recommendations: parsed.data.recommendations,
      ...(parsed.data.reassessedAt !== undefined
        ? { reassessedAt: new Date(parsed.data.reassessedAt) }
        : {}),
    });
    return NextResponse.json({ assessment });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
