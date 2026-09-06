"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface CreateProposalBody {
  proposal?: { id: string };
  error?: string;
}

const fieldClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Phase 9 Execute depth slice (AI task proposals): asks the AI coach to
 * propose a next task from a natural-language instruction. The proposal is
 * only a suggestion - it becomes a real task only when accepted, per the
 * repo's "require confirmation for consequential AI proposals" rule. Runs
 * on whatever provider is configured; with no API key that's the
 * deterministic adapter, so it always returns something to review.
 */
export function CreateTaskProposalForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (instruction.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateProposalBody>(
        `/api/workspaces/${workspaceId}/task-proposals`,
        { instruction: instruction.trim() },
      );
      if (!outcome.ok || !outcome.data.proposal) {
        setError(outcome.data.error ?? "Could not propose a task. Please try again.");
        return;
      }
      setInstruction("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-gray-500 p-4"
    >
      <p className="text-sm font-semibold text-gray-900">Ask for a task proposal</p>
      <div className="flex flex-col gap-1">
        <label htmlFor="proposal-instruction" className="text-sm font-medium text-gray-900">
          Instruction
        </label>
        <textarea
          id="proposal-instruction"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          disabled={submitting}
          rows={2}
          maxLength={1000}
          placeholder="e.g. Suggest a next action based on my most recent decision."
          className={fieldClass}
        />
      </div>
      <div>
        <Button type="submit" disabled={submitting || instruction.trim().length === 0}>
          {submitting ? "Proposing..." : "Propose a task"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
