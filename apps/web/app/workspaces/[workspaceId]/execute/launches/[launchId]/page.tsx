import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listLaunches } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { LaunchEditForm } from "./launch-edit-form";

/**
 * Phase 9 Execute depth slice (launches): a single launch. Like the other
 * detail pages there's no single-launch getter in the domain layer (only
 * listLaunches), so this finds it in the caller's own scoped list - the
 * "list then find, notFound() otherwise" pattern used across the app.
 */
export default async function LaunchDetailPage({
  params,
}: {
  params: { workspaceId: string; launchId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const launches = await listLaunches(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });
  const launch = launches.find((candidate) => candidate.id === params.launchId);
  if (!launch) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/execute/launches`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Launches
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{launch.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Plan and run a launch: set its status and date, keep notes, and work the checklist.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Launch details
        </h2>
        <LaunchEditForm
          workspaceId={params.workspaceId}
          launchId={launch.id}
          launch={{
            name: launch.name,
            status: launch.status,
            launchDate: launch.launchDate === null ? null : launch.launchDate.toISOString(),
            notes: launch.notes,
            checklist: launch.checklist,
          }}
        />
      </section>
    </div>
  );
}
