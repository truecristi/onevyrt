import { NextRequest, NextResponse } from "next/server";
import {
  listBlockResponsesForLesson,
  EnrollmentNotFoundError,
  LessonNotFoundError,
} from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

interface RouteParams {
  params: { enrollmentId: string; lessonId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const responses = await listBlockResponsesForLesson(db, {
      actorUserId: user.id,
      enrollmentId: params.enrollmentId,
      lessonId: params.lessonId,
    });
    return NextResponse.json({ responses });
  } catch (error) {
    if (error instanceof EnrollmentNotFoundError || error instanceof LessonNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
