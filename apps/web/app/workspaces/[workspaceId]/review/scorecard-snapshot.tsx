import type { WorkspaceScorecardRecord } from "@onevyrt/domain";

/**
 * Phase 9 Review slice: renders the scorecard a weekly review froze at
 * save time. Deliberately shows the deeper fields the Today page's five
 * stat tiles omit - achievement/completion rates, the experiment
 * decision breakdown, and per-metric progress - so a review is a real
 * point-in-time record ("what the numbers looked like that week"), not a
 * duplicate of Today's live summary.
 */

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

const DECISION_LABELS: Record<string, string> = {
  adopt: "adopt",
  iterate: "iterate",
  retest: "retest",
  stop: "stop",
  insufficient_evidence: "insufficient",
  reject: "reject",
};

export function ScorecardSnapshot({ snapshot }: { snapshot: WorkspaceScorecardRecord }) {
  const { goals, tasks, experiments, metrics } = snapshot;

  const decisions = Object.entries(experiments.decisionCounts).filter(([, count]) => count > 0);
  const trackedMetrics = metrics.metrics.filter((metric) => metric.progress !== null);

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Scorecard that week
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-4">
        <div>
          <dt className="text-gray-500">Goals</dt>
          <dd className="text-gray-900">
            {goals.achieved}/{goals.total} achieved
            {goals.total > 0 ? ` (${percent(goals.achievementRate)})` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Tasks</dt>
          <dd className="text-gray-900">
            {tasks.done}/{tasks.total} done
            {tasks.total > 0 ? ` (${percent(tasks.completionRate)})` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Tasks overdue</dt>
          <dd className="text-gray-900">{tasks.overdueCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Experiments</dt>
          <dd className="text-gray-900">
            {experiments.completed}/{experiments.total} completed
          </dd>
        </div>
      </dl>

      {decisions.length > 0 && (
        <p className="mt-2 text-xs text-gray-600">
          <span className="text-gray-500">Experiment decisions: </span>
          {decisions
            .map(([decision, count]) => `${DECISION_LABELS[decision] ?? decision} ${count}`)
            .join(", ")}
        </p>
      )}

      {trackedMetrics.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-500">Metric progress</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-gray-600">
            {trackedMetrics.map((metric) => (
              <li key={metric.id}>
                {metric.name}: {percent(metric.progress ?? 0)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
