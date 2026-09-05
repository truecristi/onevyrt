import { NextRequest, NextResponse } from "next/server";
import { updateNoteRequestSchema } from "@onevyrt/contracts";
import { updateNote, deleteNote, NoteNotFoundError } from "@onevyrt/domain";
import { logger, newCorrelationId } from "@onevyrt/observability";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { requireCsrf } from "@/lib/csrf";

interface RouteParams {
  params: { noteId: string };
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

  const parsed = updateNoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { db } = getServerContext();

  try {
    const note = await updateNote(db, {
      actorUserId: user.id,
      noteId: params.noteId,
      content: parsed.data.content,
    });
    logger.info("note updated", { correlationId, userId: user.id, noteId: note.id });
    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof NoteNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("note update failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const correlationId = newCorrelationId();

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { db } = getServerContext();

  try {
    await deleteNote(db, { actorUserId: user.id, noteId: params.noteId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof NoteNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("note deletion failed", { correlationId, error: (error as Error).message });
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
