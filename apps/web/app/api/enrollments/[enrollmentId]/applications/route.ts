import { NextRequest, NextResponse } from "next/server";
import { listLessonApplicationsForEnrollment, EnrollmentNotFoundError } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

interface RouteParams {
  params: { enrollmentId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { db } = getServerContext();

  try {
    const applications = await listLessonApplicationsForEnrollment(db, {
      actorUserId: user.id,
      enrollmentId: params.enrollmentId,
    });
    return NextResponse.json({ applications });
  } catch (error) {
    if (error instanceof EnrollmentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
