import Link from "next/link";
import { redirect } from "next/navigation";
import { listPrograms, listProgramVersions, listMyEnrollments } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { EnrollButton } from "./enroll-button";

/**
 * Phase 9 Learn slice: the program catalog. listPrograms already scopes
 * non-admins to "published" programs only (curriculum-use-cases.ts) - but
 * a program being published doesn't mean it has a published *version* yet
 * (the two status fields are independent, see schema.ts), so each
 * program's published version is looked up individually and programs
 * without one are left out of the list rather than shown as unenrollable
 * dead ends. This is an N+1 query pattern, acceptable at this content
 * scale (same judgment call ADR-0009 and this codebase make elsewhere).
 */
export default async function LearnPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const actorUserId = user.id;

  const [programs, enrollments] = await Promise.all([
    listPrograms(db, { actorUserId }),
    listMyEnrollments(db, { actorUserId }),
  ]);

  const enrolledVersionIds = new Set(enrollments.map((enrollment) => enrollment.programVersionId));

  const catalog = (
    await Promise.all(
      programs.map(async (program) => {
        const versions = await listProgramVersions(db, { actorUserId, programId: program.id });
        const published = versions.find((version) => version.status === "published");
        return published ? { program, publishedVersionId: published.id } : null;
      }),
    )
  ).filter((entry): entry is { program: (typeof programs)[number]; publishedVersionId: string } =>
    Boolean(entry),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Learn</h1>

      {catalog.length === 0 ? (
        <EmptyState
          title="No programs available yet"
          description="Published curriculum will show up here as soon as it exists."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {catalog.map(({ program, publishedVersionId }) => {
            const enrolled = enrolledVersionIds.has(publishedVersionId);
            return (
              <li
                key={program.id}
                className="flex items-center justify-between gap-4 rounded-md border border-gray-500 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{program.title}</p>
                  <p className="text-sm text-gray-600">{program.summary}</p>
                </div>
                {enrolled ? (
                  <Link
                    href={`/workspaces/${params.workspaceId}/learn/${program.id}`}
                    className="shrink-0 text-sm font-semibold text-blue-600 hover:underline"
                  >
                    Continue
                  </Link>
                ) : (
                  <div className="shrink-0">
                    <EnrollButton programVersionId={publishedVersionId} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
