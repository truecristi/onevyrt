import Link from "next/link";
import { redirect } from "next/navigation";
import { listAssumptions } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateAssumptionForm } from "./create-assumption-form";
import { AssumptionStatusControls } from "./assumption-status-controls";

/**
 * Phase 9 Build depth slice: assumptions. The beliefs a business is taking
 * as given - each with an optional measured value, a unit and a confidence
 * level - and whether they've been validated yet. Built on the existing
 * Phase 2/4 assumption domain and API layer; these feed scenario modeling,
 * funnel maths and the financial dashboards, so making them first-class and
 * testable is the groundwork for the modeling surfaces.
 */

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-green-100 text-green-900",
  medium: "bg-gray-900 text-white",
  low: "bg-gray-100 text-gray-900",
};

const STATUS_STYLES: Record<string, string> = {
  validated: "bg-green-100 text-green-900",
  unvalidated: "bg-blue-100 text-blue-900",
  invalidated: "bg-gray-200 text-gray-700",
};

function formatValue(value: number | null, unit: string): string | null {
  if (value === null) return null;
  const rendered = value.toString();
  return unit.trim() === "" ? rendered : `${rendered} ${unit}`;
}

export default async function AssumptionsPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const assumptions = await listAssumptions(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/build`}
          className="text-sm text-blue-700 hover:underline"
        >
          &larr; Build
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Assumptions</h1>
        <p className="mt-1 text-sm text-gray-600">
          The beliefs your numbers rest on - each with an optional value and how confident you are.
          Mark them validated or invalidated as you test them.
        </p>
      </div>

      <CreateAssumptionForm workspaceId={params.workspaceId} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          All assumptions
        </h2>
        {assumptions.length === 0 ? (
          <EmptyState
            title="No assumptions yet"
            description="Add the first belief your model depends on - you can attach a value and a confidence level."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {assumptions.map((assumption) => {
              const displayValue = formatValue(assumption.value, assumption.unit);
              return (
                <li
                  key={assumption.id}
                  className="flex items-start justify-between gap-4 rounded-md border border-gray-500 px-4 py-3"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-gray-900">{assumption.statement}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {displayValue !== null && (
                        <span className="text-sm text-gray-700">{displayValue}</span>
                      )}
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                          CONFIDENCE_STYLES[assumption.confidence] ?? CONFIDENCE_STYLES.medium
                        }`}
                      >
                        {assumption.confidence} confidence
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                          STATUS_STYLES[assumption.status] ?? STATUS_STYLES.unvalidated
                        }`}
                      >
                        {assumption.status}
                      </span>
                    </div>
                    {assumption.description.trim() !== "" && (
                      <p className="whitespace-pre-wrap text-sm text-gray-600">
                        {assumption.description}
                      </p>
                    )}
                  </div>
                  <AssumptionStatusControls
                    workspaceId={params.workspaceId}
                    assumptionId={assumption.id}
                    status={assumption.status}
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
