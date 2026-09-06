import Link from "next/link";
import { redirect } from "next/navigation";
import { listProjects } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateProjectForm } from "./create-project-form";
import { ProjectStatusControls } from "./project-status-controls";

/**
 * Phase 9 Execute depth slice: projects (README Execute -> the "task and
 * project system"; the container that groups a body of work). A
 * workspace-scoped list of projects with their status (active / completed /
 * archived). Built on the existing Phase 5 project domain layer - no domain
 * or API changes. Linking tasks to a project is a later slice; this slice
 * establishes the projects themselves.
 */

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-700 text-white",
  completed: "bg-gray-900 text-white",
  archived: "bg-gray-500 text-white",
};

export default async function ProjectsPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const projects = await listProjects(db, {
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
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-gray-600">
          The bodies of work you&rsquo;re running - each with a status. A project starts active;
          mark it completed when it&rsquo;s done, or archived to set it aside.
        </p>
      </div>

      <CreateProjectForm workspaceId={params.workspaceId} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          All projects
        </h2>
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create your first project above to start grouping the work."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex items-start justify-between gap-4 rounded-md border border-gray-500 p-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                        STATUS_STYLES[project.status] ?? STATUS_STYLES.active
                      }`}
                    >
                      {project.status}
                    </span>
                    <span className="font-medium text-gray-900">{project.name}</span>
                  </div>
                  {project.description.trim() !== "" && (
                    <p className="whitespace-pre-wrap text-sm text-gray-600">
                      {project.description}
                    </p>
                  )}
                </div>
                <ProjectStatusControls
                  workspaceId={params.workspaceId}
                  projectId={project.id}
                  status={project.status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
