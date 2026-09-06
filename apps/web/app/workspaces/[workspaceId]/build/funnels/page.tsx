import Link from "next/link";
import { redirect } from "next/navigation";
import { listFunnelStages } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateFunnelStageForm } from "./create-funnel-stage-form";
import { DeleteFunnelStageButton } from "./delete-funnel-stage-button";
import { FunnelRequirementsCalculator } from "./funnel-requirements-calculator";

/**
 * Phase 9 Build depth slice: the funnel (README Build -> "funnels"; the
 * Phase 4 funnel-mathematics domain). An ordered set of stages, each with
 * the conversion rate that maps the stage above it into it, plus a
 * deterministic "requirements" calculation that walks a target at the final
 * stage backward to the volume needed at every earlier stage. Built on the
 * existing funnel-stage domain layer - no domain or API changes.
 */
export default async function FunnelPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const unordered = await listFunnelStages(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });
  const stages = [...unordered].sort((a, b) => a.orderIndex - b.orderIndex);
  const nextOrderIndex =
    stages.length === 0 ? 0 : Math.max(...stages.map((stage) => stage.orderIndex)) + 1;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/build`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Build
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Funnel</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your conversion funnel - an ordered set of stages, each with the rate at which the stage
          above it converts into it. Then work backward from a target to what you need at the top.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Stages</h2>
        {stages.length === 0 ? (
          <EmptyState
            title="No funnel stages yet"
            description="Add your first stage below - start with the top of the funnel."
          />
        ) : (
          <ol className="flex flex-col gap-2">
            {stages.map((stage, index) => (
              <li
                key={stage.id}
                className="flex items-center justify-between gap-4 rounded-md border border-gray-500 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-500">{index + 1}</span>
                  <div>
                    <p className="font-medium text-gray-900">{stage.name}</p>
                    <p className="text-xs text-gray-500">
                      {stage.conversionRate === null
                        ? index === 0
                          ? "Top of funnel"
                          : "No conversion rate set"
                        : `${Math.round(stage.conversionRate * 100)}% from the stage above`}
                    </p>
                  </div>
                </div>
                <DeleteFunnelStageButton
                  workspaceId={params.workspaceId}
                  funnelStageId={stage.id}
                />
              </li>
            ))}
          </ol>
        )}
        <CreateFunnelStageForm workspaceId={params.workspaceId} nextOrderIndex={nextOrderIndex} />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Requirements
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            A deterministic walk backward from a target at the final stage to the volume required at
            every earlier stage.
          </p>
        </div>
        <FunnelRequirementsCalculator
          workspaceId={params.workspaceId}
          hasStages={stages.length > 0}
        />
      </section>
    </div>
  );
}
