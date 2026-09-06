import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listScenarios, resolveScenarioAssumptions } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { AssumptionOverrideControl } from "./assumption-override-control";

/**
 * Phase 9 Build depth slice: a scenario's detail. Lists every workspace
 * assumption with its baseline value alongside this scenario's value (the
 * override if one exists, otherwise the baseline), and lets you set or reset
 * a per-assumption override. Read-only on the assumptions themselves - the
 * baseline is never touched. Built on the existing Phase 4 scenario domain
 * and API layer.
 */

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "—";
  return unit.trim() === "" ? value.toString() : `${value} ${unit}`;
}

export default async function ScenarioDetailPage({
  params,
}: {
  params: { workspaceId: string; scenarioId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const actorUserId = user.id;
  const [scenarios, assumptions] = await Promise.all([
    listScenarios(db, { workspaceId: params.workspaceId, actorUserId }),
    resolveScenarioAssumptions(db, {
      workspaceId: params.workspaceId,
      actorUserId,
      scenarioId: params.scenarioId,
    }),
  ]);
  const scenario = scenarios.find((candidate) => candidate.id === params.scenarioId);
  if (!scenario) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/build/scenarios`}
          className="text-sm text-blue-700 hover:underline"
        >
          &larr; Scenarios
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{scenario.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Override any assumption for this scenario. The baseline stays untouched - only this
          scenario&rsquo;s resolved value changes.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Assumptions</h2>
        {assumptions.length === 0 ? (
          <EmptyState
            title="No assumptions to model yet"
            description="Add assumptions in Build first - a scenario overrides those, so there's nothing to model until some exist."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {assumptions.map((assumption) => (
              <li
                key={assumption.assumptionId}
                className="flex items-start justify-between gap-4 rounded-md border border-gray-500 px-4 py-3"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{assumption.statement}</span>
                    {assumption.isOverridden && (
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold uppercase text-blue-900">
                        overridden
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">
                    {formatValue(assumption.baselineValue, assumption.unit)}{" "}
                    <span className="text-gray-400">baseline</span> &middot;{" "}
                    <span className="font-medium text-gray-900">
                      {formatValue(assumption.scenarioValue, assumption.unit)}
                    </span>{" "}
                    <span className="text-gray-400">this scenario</span>
                  </p>
                </div>
                <AssumptionOverrideControl
                  workspaceId={params.workspaceId}
                  scenarioId={params.scenarioId}
                  assumptionId={assumption.assumptionId}
                  scenarioValue={assumption.scenarioValue}
                  isOverridden={assumption.isOverridden}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
