import Link from "next/link";
import { redirect } from "next/navigation";
import { listTaskProposals } from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { CreateTaskProposalForm } from "./create-task-proposal-form";
import { TaskProposalControls } from "./task-proposal-controls";

/**
 * Phase 9 Execute depth slice: AI task proposals. The AI coach proposes a
 * next task from a natural-language instruction; the proposal is a
 * suggestion only - it becomes a real task (on the Execute page) only when
 * accepted, per the repo's "require confirmation for consequential AI
 * proposals" rule. Built on the existing PRD-AI-007 task-proposal domain
 * and API layer - no domain or API changes. Runs on whatever provider is
 * configured; with no API key that's the deterministic adapter, so it
 * always returns a reviewable proposal at $0.
 */

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-600 text-white",
  high: "bg-orange-600 text-white",
  medium: "bg-gray-900 text-white",
  low: "bg-gray-100 text-gray-900",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-blue-100 text-blue-900",
  accepted: "bg-green-100 text-green-900",
  rejected: "bg-gray-100 text-gray-700",
};

export default async function TaskProposalsPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const proposals = await listTaskProposals(db, {
    workspaceId: params.workspaceId,
    actorUserId: user.id,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/workspaces/${params.workspaceId}/execute`}
          className="text-sm text-blue-700 hover:underline"
        >
          &larr; Execute
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">AI task proposals</h1>
        <p className="mt-1 text-sm text-gray-600">
          Ask the coach to propose a next task from your workspace context. Each proposal is a
          suggestion - it becomes a real task on Execute only when you accept it.
        </p>
      </div>

      <CreateTaskProposalForm workspaceId={params.workspaceId} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Proposals</h2>
        {proposals.length === 0 ? (
          <EmptyState
            title="No proposals yet"
            description="Ask for a task proposal above to get a grounded suggestion you can accept or reject."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {proposals.map((proposal) => (
              <li
                key={proposal.id}
                className="flex flex-col gap-3 rounded-md border border-gray-500 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                          PRIORITY_STYLES[proposal.proposedTask.priority] ?? PRIORITY_STYLES.medium
                        }`}
                      >
                        {proposal.proposedTask.priority}
                      </span>
                      <span className="font-medium text-gray-900">
                        {proposal.proposedTask.title}
                      </span>
                    </div>
                    <span
                      className={`w-fit rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                        STATUS_STYLES[proposal.status] ?? STATUS_STYLES.pending
                      }`}
                    >
                      {proposal.status}
                    </span>
                  </div>
                  {proposal.status === "pending" && (
                    <TaskProposalControls
                      workspaceId={params.workspaceId}
                      proposalId={proposal.id}
                    />
                  )}
                </div>
                {proposal.proposedTask.description.trim() !== "" && (
                  <p className="whitespace-pre-wrap text-sm text-gray-900">
                    {proposal.proposedTask.description}
                  </p>
                )}
                {proposal.rationale.trim() !== "" && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Rationale
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-gray-700">
                      {proposal.rationale}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
