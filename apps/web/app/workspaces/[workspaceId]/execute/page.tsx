import Link from "next/link";
import { redirect } from "next/navigation";
import { listTasks } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateTaskForm } from "./create-task-form";
import { TaskControls } from "./task-controls";

/**
 * Phase 9 Execute slice: the first real Execute destination page. Execute
 * covers "tasks, experiments, launches, outreach and implementation"
 * (README primary navigation); this slice does tasks - the headline of
 * that list and the most self-contained Execute domain. Experiments,
 * launches, projects, AI task-proposals and improvement loops each have a
 * tested domain layer already and are deferred to their own later slices.
 *
 * Built entirely on the existing Phase 2/5 task domain layer - no domain
 * or API changes.
 */

type TaskStatus = "open" | "in_progress" | "done";

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-600 text-white",
  high: "bg-orange-600 text-white",
  medium: "bg-gray-900 text-white",
  low: "bg-gray-100 text-gray-900",
};

const STATUS_GROUPS: { status: TaskStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
];

export default async function ExecutePage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const tasks = await listTasks(db, { workspaceId: params.workspaceId, actorUserId: user.id });
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Execute</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your tasks - what needs doing, and how far along it is. Experiments, launches and projects
          are coming to Execute in later slices.
        </p>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Create your first task to start tracking the work."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {STATUS_GROUPS.map(({ status, label }) => {
            const groupTasks = tasks.filter((task) => task.status === status);
            if (groupTasks.length === 0) return null;
            return (
              <section key={status} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {label} ({groupTasks.length})
                </h2>
                <ul className="flex flex-col gap-2">
                  {groupTasks.map((task) => {
                    const overdue =
                      task.status !== "done" &&
                      task.dueDate !== null &&
                      task.dueDate.getTime() < now;
                    return (
                      <li
                        key={task.id}
                        className="flex items-start justify-between gap-4 rounded-md border border-gray-500 px-4 py-3"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                                PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium
                              }`}
                            >
                              {task.priority}
                            </span>
                            <span className="font-medium text-gray-900">{task.title}</span>
                          </div>
                          {task.dueDate !== null && (
                            <p className={`text-xs ${overdue ? "text-red-700" : "text-gray-500"}`}>
                              Due {task.dueDate.toISOString().slice(0, 10)}
                              {overdue ? " - overdue" : ""}
                            </p>
                          )}
                        </div>
                        <TaskControls
                          workspaceId={params.workspaceId}
                          taskId={task.id}
                          status={task.status}
                          priority={task.priority}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <CreateTaskForm workspaceId={params.workspaceId} />

      <section className="flex flex-col gap-2 border-t border-gray-200 pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">More</h2>
        <Link
          href={`/workspaces/${params.workspaceId}/execute/task-proposals`}
          className="text-sm text-blue-700 hover:underline"
        >
          AI task proposals &rarr;
        </Link>
      </section>
    </div>
  );
}
