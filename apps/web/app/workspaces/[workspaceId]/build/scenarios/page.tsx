import Link from "next/link";
import { redirect } from "next/navigation";
import { listScenarios } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateScenarioForm } from "./create-scenario-form";

/**
 * Phase 9 Build depth slice: scenarios. Named what-ifs (base / best / worst
 * / custom) that override selected assumptions without touching the
 * baseline - so you can model "what if reply rate doubled?" against the
 * numbers you already track. Built on the existing Phase 4 scenario-modeling
 * domain and API layer; each scenario's overrides are edited on its detail
 * page.
 */

const TYPE_STYLES: Record<string, string> = {
  base: "bg-gray-100 text-gray-900",
  best: "bg-green-100 text-green-900",
  worst: "bg-red-100 text-red-900",
  custom: "bg-blue-100 text-blue-900",
};

export default async function ScenariosPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const scenarios = await listScenarios(db, {
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
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Scenarios</h1>
        <p className="mt-1 text-sm text-gray-600">
          What-if models. A scenario overrides selected assumptions without changing the baseline -
          open one to set its overrides and see the resolved values.
        </p>
      </div>

      <CreateScenarioForm workspaceId={params.workspaceId} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          All scenarios
        </h2>
        {scenarios.length === 0 ? (
          <EmptyState
            title="No scenarios yet"
            description="Create a scenario to model a what-if against your assumptions."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {scenarios.map((scenario) => (
              <li key={scenario.id}>
                <Link
                  href={`/workspaces/${params.workspaceId}/build/scenarios/${scenario.id}`}
                  className="flex items-center justify-between gap-4 rounded-md border border-gray-500 px-4 py-3 hover:border-blue-600"
                >
                  <span className="font-medium text-gray-900">{scenario.name}</span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                      TYPE_STYLES[scenario.scenarioType] ?? TYPE_STYLES.custom
                    }`}
                  >
                    {scenario.scenarioType}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
