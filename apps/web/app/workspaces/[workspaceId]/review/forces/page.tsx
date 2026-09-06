import Link from "next/link";
import { redirect } from "next/navigation";
import { getConstraintDiagnosis } from "@onevyrt/domain";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { ForceAssessmentForm } from "./force-assessment-form";

/**
 * Phase 9 Review depth slice: constraint diagnosis / Seven Forces (README
 * Review -> "constraint diagnosis"; spec 6.4). Each of the seven forces is
 * scored 0-100 against an optional target; the domain ranks the assessed
 * ones and names the primary (binding) constraint - the force most worth
 * working on next. Built on the existing Phase 7 force-assessment domain
 * layer - no domain or API changes.
 */

const FORCE_LABELS: Record<string, string> = {
  owner_psychology: "Owner psychology",
  vision_planning: "Vision & planning",
  sales_marketing: "Sales & marketing",
  people_culture: "People & culture",
  operations_systems: "Operations & systems",
  finance_measurement: "Finance & measurement",
  customer_experience: "Customer experience",
};

export default async function ForcesPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const diagnosis = await getConstraintDiagnosis(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/review`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Review
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Seven Forces</h1>
        <p className="mt-1 text-sm text-gray-600">
          Score each of the seven forces 0&ndash;100 against a target. The lowest-scoring assessed
          force, weighted by its gap to target, is your binding constraint - the one most worth
          working on next.
        </p>
      </div>

      {diagnosis.primaryConstraint ? (
        <div className="rounded-md border border-blue-600 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Binding constraint
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {FORCE_LABELS[diagnosis.primaryConstraint.force] ?? diagnosis.primaryConstraint.force}
          </p>
          <p className="text-sm text-gray-600">
            Score {diagnosis.primaryConstraint.score}
            {diagnosis.primaryConstraint.gapToTarget !== null &&
              ` · ${diagnosis.primaryConstraint.gapToTarget} below target`}
          </p>
          {diagnosis.primaryConstraint.constraintNote &&
            diagnosis.primaryConstraint.constraintNote.trim() !== "" && (
              <p className="mt-1 text-sm text-gray-600">
                {diagnosis.primaryConstraint.constraintNote}
              </p>
            )}
        </div>
      ) : (
        <p className="rounded-md border border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
          No binding constraint identified yet - assess at least one force below to see it.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Forces{" "}
          {diagnosis.unassessedForceCount > 0 &&
            `(${diagnosis.unassessedForceCount} not yet assessed)`}
        </h2>
        <ul className="flex flex-col gap-2">
          {diagnosis.forces.map((entry) => (
            <li
              key={entry.force}
              className="flex items-center justify-between gap-4 rounded-md border border-gray-500 px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-gray-900">
                  {FORCE_LABELS[entry.force] ?? entry.force}
                </span>
                {entry.assessed ? (
                  <span className="text-xs text-gray-500">
                    Score {entry.score}
                    {entry.target !== null && ` / target ${entry.target}`}
                    {entry.gapToTarget !== null && ` · gap ${entry.gapToTarget}`}
                    {entry.confidence !== null && ` · ${entry.confidence} confidence`}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">Not assessed</span>
                )}
              </div>
              {entry.assessed && entry.score !== null && (
                <span className="shrink-0 text-lg font-semibold text-gray-900">{entry.score}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <ForceAssessmentForm workspaceId={params.workspaceId} />
    </div>
  );
}
