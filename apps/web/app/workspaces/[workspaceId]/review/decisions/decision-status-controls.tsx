"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { DecisionStatus } from "@onevyrt/contracts";
import { patchJson } from "@/lib/browser-api";

interface UpdateDecisionBody {
  error?: string;
}

const STATUS_OPTIONS: { value: DecisionStatus; label: string }[] = [
  { value: "proposed", label: "Proposed" },
  { value: "decided", label: "Decided" },
  { value: "reversed", label: "Reversed" },
];

const selectClass =
  "rounded-md border border-gray-500 px-2 py-1 text-xs text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Phase 9 Review depth slice (decision log): moves one decision between
 * proposed / decided / reversed. The domain derives decidedAt from the
 * status (set when it becomes "decided", cleared otherwise), so this only
 * ever sends the status.
 */
export function DecisionStatusControls({
  workspaceId,
  decisionId,
  status,
}: {
  workspaceId: string;
  decisionId: string;
  status: DecisionStatus;
}) {
  const router = useRouter();
  const selectId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleChange(next: DecisionStatus) {
    if (next === status) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await patchJson<UpdateDecisionBody>(
        `/api/workspaces/${workspaceId}/decisions/${decisionId}`,
        { status: next },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not update.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label htmlFor={selectId} className="sr-only">
        Decision status
      </label>
      <select
        id={selectId}
        value={status}
        onChange={(event) => handleChange(event.target.value as DecisionStatus)}
        disabled={submitting}
        className={selectClass}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
