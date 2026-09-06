import Link from "next/link";
import { redirect } from "next/navigation";
import { listTasks, listExperiments } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateTaskForm } from "./create-task-form";
import { CreateExperimentForm } from "./create-experiment-form";
import { TaskControls } from "./task-controls";

/**
 * Phase 9 Execute slice: the Execute destination page. Execute covers
 * "tasks, experiments, launches, outreach and implementation" (README
 * primary navigation). This page does tasks (the first slice) and
 * experiments (a later depth slice - the build->test->learn loop). Launches,
 * projects, AI task-proposals and improvement loops each have a tested
 * domain layer already and are deferred to their own later slices.
 *
 * Built entirely on the existing Phase 2/5 task and experiment domain
 * layers - no domain or API changes.
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

const EXPERIMENT_STATUS_STYLES: Record<string, string> = {
  planned: "bg-gray-100 text-gray-900",
  running: "bg-blue-600 text-white",
  completed: "bg-green-700 text-white",
  abandoned: "bg-gray-500 text-white",
};

const DECISION_LABELS: Record<string, string> = {
  adopt: "adopt",
  iterate: "iterate",
  retest: "retest",
  stop: "stop",
  insufficient_evidence: "insufficient evidence",
  reject: "reject",
};

export default async function ExecutePage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const actorUserId = user.id;
  const [tasks, experiments] = await Promise.all([
    listTasks(db, { workspaceId: params.workspaceId, actorUserId }),
    listExperiments(db, { workspaceId: params.workspaceId, actorUserId }),
  ]);
  const now = Date.now();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Execute</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your tasks and experiments - the work to do and the ideas you&rsquo;re testing. Launches
          and projects are coming to Execute in later slices.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Tasks</h2>
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
                <div key={status} className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {label} ({groupTasks.length})
                  </h3>
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
                              <p
                                className={`text-xs ${overdue ? "text-red-700" : "text-gray-500"}`}
                              >
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
                </div>
              );
            })}
          </div>
        )}
        <CreateTaskForm workspaceId={params.workspaceId} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Experiments</h2>
        {experiments.length === 0 ? (
          <EmptyState
            title="No experiments yet"
            description="Start an experiment to test an idea and record what you learn."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {experiments.map((experiment) => (
              <li key={experiment.id}>
                <Link
                  href={`/workspaces/${params.workspaceId}/execute/experiments/${experiment.id}`}
                  className="flex items-start justify-between gap-4 rounded-md border border-gray-500 px-4 py-3 hover:border-blue-600"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-gray-900">{experiment.name}</span>
                    {experiment.hypothesis !== "" && (
                      <span className="text-sm text-gray-600">{experiment.hypothesis}</span>
                    )}
                    {experiment.decision !== null && (
                      <span className="text-xs text-gray-500">
                        Decision: {DECISION_LABELS[experiment.decision] ?? experiment.decision}
                      </span>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                      EXPERIMENT_STATUS_STYLES[experiment.status] ??
                      EXPERIMENT_STATUS_STYLES.planned
                    }`}
                  >
                    {experiment.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <CreateExperimentForm workspaceId={params.workspaceId} />
      </section>
    </div>
  );
}
