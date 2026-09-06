import Link from "next/link";
import { redirect } from "next/navigation";
import { listGoals } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateGoalForm } from "./create-goal-form";
import { GoalStatusControls } from "./goal-status-controls";

/**
 * Phase 9 Today depth slice: goals. The strategic targets the workspace is
 * working toward - the same goals the Today scorecard summarises as
 * "Goals achieved N / M". This page manages them in full: set a goal with
 * an optional target date, then mark it achieved or abandoned. Built on the
 * existing Phase 2 business-core goal domain and API layer.
 */

const STATUS_STYLES: Record<string, string> = {
  active: "bg-blue-100 text-blue-900",
  achieved: "bg-green-100 text-green-900",
  abandoned: "bg-gray-200 text-gray-700",
};

export default async function GoalsPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const goals = await listGoals(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/today`}
          className="text-sm text-blue-700 hover:underline"
        >
          &larr; Today
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Goals</h1>
        <p className="mt-1 text-sm text-gray-600">
          What you&rsquo;re working toward. These are what the Today scorecard counts as achieved -
          set one, then mark it achieved or abandoned as things play out.
        </p>
      </div>

      <CreateGoalForm workspaceId={params.workspaceId} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">All goals</h2>
        {goals.length === 0 ? (
          <EmptyState
            title="No goals yet"
            description="Set the first thing you're working toward - you can give it a target date."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {goals.map((goal) => {
              const overdue =
                goal.status === "active" &&
                goal.targetDate !== null &&
                goal.targetDate.getTime() < now;
              return (
                <li
                  key={goal.id}
                  className="flex items-start justify-between gap-4 rounded-md border border-gray-500 px-4 py-3"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{goal.title}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                          STATUS_STYLES[goal.status] ?? STATUS_STYLES.active
                        }`}
                      >
                        {goal.status}
                      </span>
                    </div>
                    {goal.description.trim() !== "" && (
                      <p className="whitespace-pre-wrap text-sm text-gray-600">
                        {goal.description}
                      </p>
                    )}
                    {goal.targetDate !== null && (
                      <p className={`text-xs ${overdue ? "text-red-700" : "text-gray-500"}`}>
                        Target {goal.targetDate.toISOString().slice(0, 10)}
                        {overdue ? " - overdue" : ""}
                      </p>
                    )}
                  </div>
                  <GoalStatusControls
                    workspaceId={params.workspaceId}
                    goalId={goal.id}
                    status={goal.status}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
