import { NextRequest, NextResponse } from "next/server";
import { createBookmarkRequestSchema } from "@onevyrt/contracts";
import { addBookmark, listMyBookmarks, LessonNotFoundError } from "@onevyrt/domain";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

// Not workspace-scoped: bookmarks belong to the individual learner's own
// account (see the doc comment on schema.ts's bookmarks table).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();
  const bookmarks = await listMyBookmarks(db, { actorUserId: user.id });
  return NextResponse.json({ bookmarks });
}

export async function POST(request: NextRequest) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = createBookmarkRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const bookmark = await addBookmark(db, {
      actorUserId: user.id,
      lessonId: parsed.data.lessonId,
    });
    logger.info("bookmark added", { correlationId, userId: user.id, bookmarkId: bookmark.id });
    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    if (error instanceof LessonNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("bookmark creation failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to add bookmark" }, { status: 500 });
  }
}
