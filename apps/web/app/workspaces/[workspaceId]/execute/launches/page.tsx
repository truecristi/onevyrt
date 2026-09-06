import Link from "next/link";
import { redirect } from "next/navigation";
import { listLaunches } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateLaunchForm } from "./create-launch-form";

/**
 * Phase 9 Execute depth slice: launches (README Execute -> "launch
 * workflows"). A workspace-scoped list of launches, each with a status, an
 * optional date and a checklist; the detail page runs each one. Built on
 * the existing Phase 5 launch domain layer - no domain or API changes.
 */

const STATUS_STYLES: Record<string, string> = {
  planning: "bg-gray-100 text-gray-900",
  scheduled: "bg-blue-600 text-white",
  live: "bg-green-700 text-white",
  completed: "bg-gray-900 text-white",
  cancelled: "bg-gray-500 text-white",
};

export default async function LaunchesPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const launches = await listLaunches(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/execute`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Execute
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Launches</h1>
        <p className="mt-1 text-sm text-gray-600">
          The launches you&rsquo;re planning and running - each with a status, an optional date, and
          a checklist to work through. Open one to flesh it out.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          All launches
        </h2>
        {launches.length === 0 ? (
          <EmptyState
            title="No launches yet"
            description="Create your first launch below to start planning it."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {launches.map((launch) => {
              const done = launch.checklist.filter((item) => item.done).length;
              return (
                <li key={launch.id}>
                  <Link
                    href={`/workspaces/${params.workspaceId}/execute/launches/${launch.id}`}
                    className="flex items-start justify-between gap-4 rounded-md border border-gray-500 px-4 py-3 hover:border-blue-600"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-gray-900">{launch.name}</span>
                      <span className="text-xs text-gray-500">
                        {launch.launchDate !== null &&
                          `${launch.launchDate.toISOString().slice(0, 10)} · `}
                        {launch.checklist.length > 0
                          ? `${done}/${launch.checklist.length} checklist done`
                          : "No checklist yet"}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                        STATUS_STYLES[launch.status] ?? STATUS_STYLES.planning
                      }`}
                    >
                      {launch.status}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <CreateLaunchForm workspaceId={params.workspaceId} />
      </section>
    </div>
  );
}
