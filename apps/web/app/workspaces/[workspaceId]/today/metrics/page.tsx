import Link from "next/link";
import { redirect } from "next/navigation";
import { listBusinessMetrics } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateMetricForm } from "./create-metric-form";
import { MetricValueControl } from "./metric-value-control";

/**
 * Phase 9 Today depth slice: business metrics. The numbers the workspace
 * tracks toward a target - the same metrics the Today scorecard summarises
 * as "Metrics tracked N". This page manages them: define a metric with a
 * direction, cadence and target, then log its current value over time.
 * Built on the existing Phase 2 business-metric domain and API layer.
 */

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "—";
  return unit.trim() === "" ? value.toString() : `${value} ${unit}`;
}

function reachedTarget(
  current: number | null,
  target: number | null,
  direction: "increase" | "decrease",
): boolean {
  if (current === null || target === null) return false;
  return direction === "increase" ? current >= target : current <= target;
}

export default async function MetricsPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const metrics = await listBusinessMetrics(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/today`}
          className="text-sm text-blue-700 hover:underline"
        >
          &larr; Today
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Metrics</h1>
        <p className="mt-1 text-sm text-gray-600">
          The numbers you&rsquo;re tracking toward a target. These are what the Today scorecard
          counts as tracked - log the current value as it changes.
        </p>
      </div>

      <CreateMetricForm workspaceId={params.workspaceId} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">All metrics</h2>
        {metrics.length === 0 ? (
          <EmptyState
            title="No metrics yet"
            description="Track the first number that matters - give it a direction, cadence and target."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {metrics.map((metric) => {
              const reached = reachedTarget(
                metric.currentValue,
                metric.targetValue,
                metric.direction,
              );
              return (
                <li
                  key={metric.id}
                  className="flex flex-col gap-2 rounded-md border border-gray-500 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{metric.name}</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase text-gray-700">
                          {metric.direction}
                        </span>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase text-gray-700">
                          {metric.cadence}
                        </span>
                        {reached && (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold uppercase text-green-900">
                            target reached
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">
                        {formatValue(metric.baselineValue, metric.unit)}{" "}
                        <span className="text-gray-400">baseline</span> &middot;{" "}
                        <span className="font-medium text-gray-900">
                          {formatValue(metric.currentValue, metric.unit)}
                        </span>{" "}
                        <span className="text-gray-400">current</span> &middot;{" "}
                        {formatValue(metric.targetValue, metric.unit)}{" "}
                        <span className="text-gray-400">target</span>
                      </p>
                    </div>
                    <MetricValueControl
                      workspaceId={params.workspaceId}
                      metricId={metric.id}
                      currentValue={metric.currentValue}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
