import Link from "next/link";
import { redirect } from "next/navigation";
import { listDecisions } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateDecisionForm } from "./create-decision-form";
import { DecisionStatusControls } from "./decision-status-controls";

/**
 * Phase 9 Review depth slice: the decision log (README Review -> the
 * "insights" the destination keeps; decision history). A workspace-scoped
 * record of the decisions taken - the title, the context that led to each,
 * the intended outcome, and where it stands (proposed / decided / reversed).
 * Built on the existing Phase 2 decision domain layer - no domain or API
 * changes; the domain stamps decidedAt when a decision becomes "decided".
 */

const STATUS_STYLES: Record<string, string> = {
  proposed: "bg-gray-100 text-gray-900",
  decided: "bg-green-700 text-white",
  reversed: "bg-gray-500 text-white",
};

export default async function DecisionLogPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const decisions = await listDecisions(db, {
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
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Decision log</h1>
        <p className="mt-1 text-sm text-gray-600">
          The decisions you&rsquo;ve taken - what you decided, the context behind it, and where it
          stands. A decision starts proposed; mark it decided once it&rsquo;s made, or reversed if
          you change course.
        </p>
      </div>

      <CreateDecisionForm workspaceId={params.workspaceId} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">History</h2>
        {decisions.length === 0 ? (
          <EmptyState
            title="No decisions yet"
            description="Record your first decision above to start keeping a history of what you chose and why."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {decisions.map((decision) => (
              <li
                key={decision.id}
                className="flex flex-col gap-3 rounded-md border border-gray-500 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                          STATUS_STYLES[decision.status] ?? STATUS_STYLES.proposed
                        }`}
                      >
                        {decision.status}
                      </span>
                      <span className="font-medium text-gray-900">{decision.title}</span>
                    </div>
                    {decision.decidedAt !== null && (
                      <p className="text-xs text-gray-500">
                        Decided {decision.decidedAt.toISOString().slice(0, 10)}
                      </p>
                    )}
                  </div>
                  <DecisionStatusControls
                    workspaceId={params.workspaceId}
                    decisionId={decision.id}
                    status={decision.status}
                  />
                </div>
                <dl className="flex flex-col gap-2 text-sm">
                  {decision.context.trim() !== "" && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Context
                      </dt>
                      <dd className="whitespace-pre-wrap text-gray-900">{decision.context}</dd>
                    </div>
                  )}
                  {decision.outcome.trim() !== "" && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Outcome
                      </dt>
                      <dd className="whitespace-pre-wrap text-gray-900">{decision.outcome}</dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
