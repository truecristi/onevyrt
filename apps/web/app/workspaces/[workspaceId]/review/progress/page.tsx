import Link from "next/link";
import { redirect } from "next/navigation";
import { getProgressSummary } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

/**
 * Phase 9 Review depth slice: progress summary (README Review -> "progress
 * summaries"). A read-only comparison of the workspace's current scorecard
 * against the closest saved weekly-review snapshot at or before a chosen
 * number of weeks back. Built on the existing Phase 7 progress-summary
 * domain layer - no domain or API changes. Weekly reviews are the only
 * historical baseline, so a workspace with none yet sees just its current
 * values with a note to start saving reviews.
 */

const LOOKBACKS = [4, 8, 12] as const;

function percent(rate: number | null): string {
  return rate === null ? "-" : `${Math.round(rate * 100)}%`;
}

function pointsDelta(delta: number | null): string | null {
  if (delta === null || delta === 0) return null;
  const pts = Math.round(delta * 100);
  return `${pts > 0 ? "+" : ""}${pts} pts`;
}

function countDelta(delta: number | null): string | null {
  if (delta === null || delta === 0) return null;
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function deltaClass(delta: number | null): string {
  if (delta === null || delta === 0) return "text-gray-500";
  return delta > 0 ? "text-green-700" : "text-red-700";
}

export default async function ProgressSummaryPage({
  params,
  searchParams,
}: {
  params: { workspaceId: string };
  searchParams: { weeksBack?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const requested = Number(searchParams.weeksBack);
  const weeksBack =
    Number.isInteger(requested) && requested >= 1 && requested <= 52 ? requested : 4;

  const { db } = getServerContext();
  const summary = await getProgressSummary(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
    weeksBack,
  });

  const rateStats: { label: string; entry: (typeof summary)["goalsAchievementRate"] }[] = [
    { label: "Goals achievement rate", entry: summary.goalsAchievementRate },
    { label: "Tasks completion rate", entry: summary.tasksCompletionRate },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/review`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Review
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Progress</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your current scorecard compared to a past weekly-review snapshot. Weekly reviews are the
          baseline, so save them regularly to build a trend.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Compare against:</span>
        {LOOKBACKS.map((n) => (
          <Link
            key={n}
            href={`/workspaces/${params.workspaceId}/review/progress?weeksBack=${n}`}
            className={`rounded px-2 py-0.5 ${
              n === weeksBack ? "bg-blue-600 text-white" : "text-blue-600 hover:underline"
            }`}
          >
            {n} weeks ago
          </Link>
        ))}
      </div>

      {summary.hasComparison ? (
        <p className="text-sm text-gray-600">
          Comparing to the weekly review from the week of{" "}
          <span className="font-medium text-gray-900">
            {summary.comparisonWeekStartDate?.toISOString().slice(0, 10)}
          </span>
          .
        </p>
      ) : (
        <p className="rounded-md border border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
          No comparison baseline yet - there&rsquo;s no saved weekly review at or before {weeksBack}{" "}
          weeks ago. Showing current values; save weekly reviews to start tracking the trend.
        </p>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rateStats.map(({ label, entry }) => {
          const change = pointsDelta(entry.delta);
          return (
            <div key={label} className="rounded-md border border-gray-300 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{percent(entry.current)}</p>
              {change && <p className={`text-xs ${deltaClass(entry.delta)}`}>{change}</p>}
            </div>
          );
        })}
        <div className="rounded-md border border-gray-300 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Experiments completed
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {summary.experimentsCompleted.current}
          </p>
          {countDelta(summary.experimentsCompleted.delta) && (
            <p className={`text-xs ${deltaClass(summary.experimentsCompleted.delta)}`}>
              {countDelta(summary.experimentsCompleted.delta)}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Metric progress
        </h2>
        {summary.metrics.length === 0 ? (
          <p className="text-sm text-gray-500">
            No business metrics with a target yet - add metrics to track their progress here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Metric
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Current
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.metrics.map((metric) => {
                  const change = pointsDelta(metric.delta);
                  return (
                    <tr key={metric.metricId} className="border-b border-gray-200">
                      <td className="px-3 py-2 text-sm text-gray-900">{metric.name}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">
                        {percent(metric.currentProgress)}
                      </td>
                      <td className={`px-3 py-2 text-sm ${deltaClass(metric.delta)}`}>
                        {change ?? "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
