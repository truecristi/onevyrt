import Link from "next/link";
import { getWorkspaceScorecard, getRecommendations } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

/**
 * Phase 9 second UI slice: the first of the five real destinations -
 * "Today", the workspace's live status. Both queries here
 * (getWorkspaceScorecard, getRecommendations) already existed and were
 * already tested (Phase 7) - this page is the first thing that actually
 * renders them, rather than a curl response.
 */

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-600 text-white",
  medium: "bg-gray-900 text-white",
  low: "bg-gray-100 text-gray-900",
};

export default async function TodayPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const actorUserId = user.id;
  const workspaceId = params.workspaceId;

  const [scorecard, recommendationsResult] = await Promise.all([
    getWorkspaceScorecard(db, { workspaceId, actorUserId }),
    getRecommendations(db, { workspaceId, actorUserId }),
  ]);

  const stats = [
    { label: "Goals achieved", value: `${scorecard.goals.achieved} / ${scorecard.goals.total}` },
    { label: "Tasks done", value: `${scorecard.tasks.done} / ${scorecard.tasks.total}` },
    { label: "Tasks overdue", value: scorecard.tasks.overdueCount },
    { label: "Experiments running", value: scorecard.experiments.running },
    { label: "Metrics tracked", value: scorecard.metrics.total },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold tracking-tight">Today</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-md border border-gray-500 px-4 py-3">
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link
            href={`/workspaces/${params.workspaceId}/today/goals`}
            className="text-sm text-blue-700 hover:underline"
          >
            Manage goals &rarr;
          </Link>
          <Link
            href={`/workspaces/${params.workspaceId}/today/metrics`}
            className="text-sm text-blue-700 hover:underline"
          >
            Track metrics &rarr;
          </Link>
          <Link
            href={`/workspaces/${params.workspaceId}/today/profile`}
            className="text-sm text-blue-700 hover:underline"
          >
            Business profile &rarr;
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Recommendations
        </h2>
        {recommendationsResult.recommendations.length === 0 ? (
          <EmptyState
            title="No recommendations yet"
            description="Recommendations are generated from goals, tasks, experiments and force assessments - add some workspace data to see them here."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {recommendationsResult.recommendations.map((recommendation, index) => (
              <li
                key={`${recommendation.source}-${index}`}
                className="rounded-md border border-gray-500 px-4 py-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                      PRIORITY_STYLES[recommendation.priority] ?? PRIORITY_STYLES.low
                    }`}
                  >
                    {recommendation.priority}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{recommendation.title}</span>
                </div>
                <p className="text-sm text-gray-600">{recommendation.rationale}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
