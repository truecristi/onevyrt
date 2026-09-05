import { NextRequest, NextResponse } from "next/server";
import { calculateUnitEconomicsRequestSchema } from "@onevyrt/contracts";
import {
  calculateUnitEconomics,
  OfferNotFoundError,
  OfferPriceRequiredError,
} from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; offerId: string };
}

// A computation route, same reasoning as the formula compute and funnel
// requirements routes: the report is derived fresh from the offer's
// current price plus caller-supplied cost/CAC/LTV inputs, never stored.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = calculateUnitEconomicsRequestSchema.safeParse(
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
    const report = await calculateUnitEconomics(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      offerId: params.offerId,
      ...parsed.data,
    });
    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof OfferNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof OfferPriceRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
