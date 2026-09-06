import Link from "next/link";
import { redirect } from "next/navigation";
import { getExperimentAnalysis } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";

/**
 * Phase 9 Review depth slice: experiment analysis (README Review ->
 * "experiment analysis"). A read-only aggregation over the workspace's
 * experiments and assumptions - throughput (cycle time), the decision mix,
 * and which assumptions have actually been tested. Built on the existing
 * Phase 7 experiment-analysis domain layer - no domain or API changes.
 */

const DECISION_LABELS: Record<string, string> = {
  adopt: "Adopt",
  iterate: "Iterate",
  retest: "Retest",
  stop: "Stop",
  insufficient_evidence: "Insufficient evidence",
  reject: "Reject",
};

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-gray-100 text-gray-900",
  running: "bg-blue-600 text-white",
  completed: "bg-green-700 text-white",
  abandoned: "bg-gray-500 text-white",
};

const cellClass = "px-3 py-2 text-sm text-gray-900";
const headClass = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";

export default async function ExperimentAnalysisPage({
  params,
}: {
  params: { workspaceId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const analysis = await getExperimentAnalysis(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });

  const decisions = Object.entries(analysis.decisionCounts).filter(([, count]) => count > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/review`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Review
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Experiment analysis</h1>
        <p className="mt-1 text-sm text-gray-600">
          How your experiments are going: how many you&rsquo;ve run, how long they take, what you
          decided, and which assumptions you&rsquo;ve actually tested.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-gray-300 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Experiments</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{analysis.totalExperiments}</p>
        </div>
        <div className="rounded-md border border-gray-300 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Avg cycle time
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {analysis.averageCycleTimeDays === null
              ? "-"
              : `${Math.round(analysis.averageCycleTimeDays)}d`}
          </p>
          <p className="text-xs text-gray-500">{analysis.timedExperimentCount} timed</p>
        </div>
        <div className="rounded-md border border-gray-300 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Assumptions tested
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {analysis.testedAssumptionCount}/{analysis.totalAssumptions}
          </p>
        </div>
        <div className="rounded-md border border-gray-300 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Untested</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {analysis.untestedAssumptionCount}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Decisions</h2>
        {decisions.length === 0 ? (
          <p className="text-sm text-gray-500">
            No decisions recorded yet - complete an experiment and record its decision to see the
            mix here.
          </p>
        ) : (
          <p className="text-sm text-gray-700">
            {decisions
              .map(([decision, count]) => `${DECISION_LABELS[decision] ?? decision}: ${count}`)
              .join(" · ")}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Assumption coverage
        </h2>
        {analysis.assumptionCoverage.length === 0 ? (
          <p className="text-sm text-gray-500">
            No assumptions yet - link experiments to assumptions to track which ones are tested.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {analysis.assumptionCoverage.map((entry) => (
              <li
                key={entry.assumptionId}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="text-gray-900">{entry.statement}</span>
                <span
                  className={`shrink-0 text-xs ${
                    entry.experimentCount === 0 ? "text-red-700" : "text-gray-500"
                  }`}
                >
                  {entry.experimentCount === 0
                    ? "untested"
                    : `${entry.experimentCount} experiment${entry.experimentCount === 1 ? "" : "s"}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Experiments</h2>
        {analysis.experiments.length === 0 ? (
          <p className="text-sm text-gray-500">No experiments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className={headClass}>Experiment</th>
                  <th className={headClass}>Status</th>
                  <th className={headClass}>Decision</th>
                  <th className={headClass}>Cycle time</th>
                </tr>
              </thead>
              <tbody>
                {analysis.experiments.map((experiment) => (
                  <tr key={experiment.id} className="border-b border-gray-200">
                    <td className={cellClass}>{experiment.name}</td>
                    <td className={cellClass}>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                          STATUS_STYLES[experiment.status] ?? STATUS_STYLES.planned
                        }`}
                      >
                        {experiment.status}
                      </span>
                    </td>
                    <td className={cellClass}>
                      {experiment.decision === null
                        ? "-"
                        : (DECISION_LABELS[experiment.decision] ?? experiment.decision)}
                    </td>
                    <td className={cellClass}>
                      {experiment.cycleTimeDays === null ? "-" : `${experiment.cycleTimeDays}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
