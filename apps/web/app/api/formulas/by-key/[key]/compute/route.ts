import { NextRequest, NextResponse } from "next/server";
import { computeFormulaRequestSchema } from "@onevyrt/contracts";
import {
  computeFormula,
  NoPublishedFormulaError,
  FormulaInputMismatchError,
  FormulaImplementationNotFoundError,
} from "@onevyrt/domain";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { key: string };
}

// Lives under the "by-key" prefix rather than directly under
// /api/formulas/[...] because /api/formulas/[formulaDefinitionId]/publish
// already claims that sibling dynamic segment by a different name - Next.js
// requires every dynamic segment at the same path position to share one
// name, and this route is keyed by a formula's `key` (stable, e.g.
// "gross_profit"), not its row id, so the two can't be the same segment.
//
// Computing against a published formula is not privileged - see
// computeFormula's doc comment. Still requires authentication (nothing
// in this app is anonymous), but no workspace/platform-admin check: any
// signed-in user can run a published calculation against their own
// numbers, the same way any workspace member can read published
// curriculum content.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = computeFormulaRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const result = await computeFormula(db, { key: params.key, inputs: parsed.data.inputs });
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof NoPublishedFormulaError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof FormulaInputMismatchError) {
      return NextResponse.json(
        { error: error.message, missing: error.missing, unexpected: error.unexpected },
        { status: 400 },
      );
    }
    if (error instanceof FormulaImplementationNotFoundError) {
      logger.error("formula published with no matching implementation", {
        correlationId,
        key: params.key,
        error: error.message,
      });
      return NextResponse.json({ error: "Formula is temporarily unavailable" }, { status: 500 });
    }
    logger.error("formula computation failed", {
      correlationId,
      key: params.key,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to compute formula" }, { status: 500 });
  }
}
