import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  listPrograms,
  listProgramVersions,
  listLessons,
  listMyEnrollments,
  listLessonProgress,
} from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { EnrollButton } from "../enroll-button";

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  in_progress: "In progress",
};

/**
 * Phase 9 Learn slice: a single program's lesson list. There's no
 * standalone "getProgramById" in curriculum-use-cases.ts - listPrograms
 * already scopes to what this caller may see, so finding by id in that
 * result is the same "list then find" pattern the workspace layout uses
 * for listWorkspacesForUser.
 */
export default async function ProgramDetailPage({
  params,
}: {
  params: { workspaceId: string; programId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const actorUserId = user.id;

  const programs = await listPrograms(db, { actorUserId });
  const program = programs.find((candidate) => candidate.id === params.programId);
  if (!program) {
    notFound();
  }

  const versions = await listProgramVersions(db, { actorUserId, programId: program.id });
  const published = versions.find((version) => version.status === "published");
  if (!published) {
    notFound();
  }

  const [lessons, enrollments] = await Promise.all([
    listLessons(db, { actorUserId, programVersionId: published.id }),
    listMyEnrollments(db, { actorUserId }),
  ]);
  const enrollment = enrollments.find((candidate) => candidate.programVersionId === published.id);

  const progressByLessonId = enrollment
    ? new Map(
        (await listLessonProgress(db, { actorUserId, enrollmentId: enrollment.id })).map(
          (progress) => [progress.lessonId, progress],
        ),
      )
    : new Map();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{program.title}</h1>
        <p className="mt-1 text-sm text-gray-600">{program.summary}</p>
      </div>

      {!enrollment && (
        <div className="flex items-center justify-between rounded-md border border-gray-500 px-4 py-3">
          <p className="text-sm text-gray-600">Enroll to start tracking your progress.</p>
          <EnrollButton programVersionId={published.id} />
        </div>
      )}

      {lessons.length === 0 ? (
        <EmptyState
          title="No lessons published yet"
          description="This program's published version doesn't have any published lessons yet."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {lessons.map((lesson) => {
            const progress = progressByLessonId.get(lesson.id);
            const statusLabel = progress ? STATUS_LABELS[progress.status] : undefined;
            const content = (
              <div className="flex items-center justify-between gap-4 rounded-md border border-gray-500 px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{lesson.title}</p>
                  <p className="text-sm text-gray-600">{lesson.outcome}</p>
                </div>
                {statusLabel && (
                  <span className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase text-gray-500">
                    {statusLabel}
                  </span>
                )}
              </div>
            );
            return (
              <li key={lesson.id}>
                {enrollment ? (
                  <Link
                    href={`/workspaces/${params.workspaceId}/learn/${program.id}/lessons/${lesson.id}`}
                    className="block hover:border-blue-600"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
