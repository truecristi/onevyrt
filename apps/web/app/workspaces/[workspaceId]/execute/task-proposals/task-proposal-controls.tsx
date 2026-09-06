"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface MutationBody {
  proposal?: { id: string };
  error?: string;
}

/**
 * Phase 9 Execute depth slice (AI task proposals): the accept/reject
 * controls on a pending proposal. Accepting has the real side effect of
 * creating a task, so it goes through the dedicated action route (a plain
 * body-less POST with CSRF), not a status PATCH - matching the accept
 * route's own shape. Both refresh the Server Component so the proposal
 * re-renders under its new status and any created task shows up on Execute.
 */
export function TaskProposalControls({
  workspaceId,
  proposalId,
}: {
  workspaceId: string;
  proposalId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function review(action: "accept" | "reject") {
    setPending(true);
    setError(undefined);
    try {
      const outcome = await postJson<MutationBody>(
        `/api/workspaces/${workspaceId}/task-proposals/${proposalId}/${action}`,
        {},
      );
      if (!outcome.ok || !outcome.data.proposal) {
        setError(outcome.data.error ?? `Could not ${action} this proposal.`);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button type="button" variant="primary" disabled={pending} onClick={() => review("accept")}>
          {pending ? "Working..." : "Accept"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => review("reject")}
        >
          Reject
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
