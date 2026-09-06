import { NextRequest, NextResponse } from "next/server";
import { createNoteRequestSchema } from "@onevyrt/contracts";
import { createNote, listNotesForLesson, LessonNotFoundError } from "@onevyrt/domain";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { lessonId: string };
}

// Not workspace-scoped: notes belong to the individual learner's own
// account (see the doc comment on schema.ts's notes table).
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();
  const notes = await listNotesForLesson(db, {
    actorUserId: user.id,
    lessonId: params.lessonId,
  });
  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createNoteRequestSchema.safeParse({ ...body, lessonId: params.lessonId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const note = await createNote(db, {
      actorUserId: user.id,
      lessonId: params.lessonId,
      content: parsed.data.content,
    });
    logger.info("note created", { correlationId, userId: user.id, noteId: note.id });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    if (error instanceof LessonNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("note creation failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
