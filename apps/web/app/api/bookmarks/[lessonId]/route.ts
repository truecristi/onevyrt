import { NextRequest, NextResponse } from "next/server";
import { removeBookmark } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { lessonId: string };
}

// Idempotent by design (see removeBookmark's doc comment) - always
// returns 204, whether or not a bookmark existed.
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { db } = getServerContext();
  await removeBookmark(db, { actorUserId: user.id, lessonId: params.lessonId });
  return new NextResponse(null, { status: 204 });
}
