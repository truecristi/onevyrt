import { NextRequest, NextResponse } from "next/server";
import { updateCustomerProfileRequestSchema } from "@onevyrt/contracts";
import { updateCustomerProfile, CustomerProfileNotFoundError } from "@onevyrt/domain";
import { WorkspaceAccessDeniedError } from "@onevyrt/auth";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { workspaceId: string; customerProfileId: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = updateCustomerProfileRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  // Zod's .optional() types omitted fields as `key?: T | undefined`, but
  // exactOptionalPropertyTypes forbids passing an explicit `undefined` for
  // an optional property typed as just `T` - strip any keys Zod left
  // present-but-undefined before spreading into the domain call.
  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );

  try {
    const customerProfile = await updateCustomerProfile(db, {
      workspaceId: params.workspaceId,
      actorUserId: user.id,
      customerProfileId: params.customerProfileId,
      ...patch,
    });
    logger.info("customer profile updated", {
      correlationId,
      userId: user.id,
      workspaceId: params.workspaceId,
      customerProfileId: customerProfile.id,
    });
    return NextResponse.json({ customerProfile });
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof CustomerProfileNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("customer profile update failed", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to update customer profile" }, { status: 500 });
  }
}
