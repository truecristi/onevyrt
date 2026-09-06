import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listExperiments } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { ExperimentEditForm } from "./experiment-edit-form";

/**
 * Phase 9 Execute depth slice (experiments): a single experiment. Like the
 * offer and customer-profile detail pages there's no single-experiment
 * getter in the domain layer (only listExperiments), so this finds it in
 * the caller's own scoped list - the "list then find, notFound() otherwise"
 * pattern used across the app, which also keeps a guessed id from another
 * workspace from resolving here.
 */
export default async function ExperimentDetailPage({
  params,
}: {
  params: { workspaceId: string; experimentId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const experiments = await listExperiments(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });
  const experiment = experiments.find((candidate) => candidate.id === params.experimentId);
  if (!experiment) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/execute`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Execute
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{experiment.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          The build&rarr;test&rarr;learn loop for one idea: state the hypothesis, run it, record
          what happened, and decide what to do next.
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          <div>
            <dt className="inline">Started: </dt>
            <dd className="inline text-gray-900">
              {experiment.startedAt === null
                ? "not yet"
                : experiment.startedAt.toISOString().slice(0, 10)}
            </dd>
          </div>
          <div>
            <dt className="inline">Ended: </dt>
            <dd className="inline text-gray-900">
              {experiment.endedAt === null
                ? "not yet"
                : experiment.endedAt.toISOString().slice(0, 10)}
            </dd>
          </div>
        </dl>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Experiment details
        </h2>
        <ExperimentEditForm
          workspaceId={params.workspaceId}
          experimentId={experiment.id}
          experiment={{
            name: experiment.name,
            hypothesis: experiment.hypothesis,
            method: experiment.method,
            status: experiment.status,
            result: experiment.result,
            decision: experiment.decision,
          }}
        />
      </section>
    </div>
  );
}
