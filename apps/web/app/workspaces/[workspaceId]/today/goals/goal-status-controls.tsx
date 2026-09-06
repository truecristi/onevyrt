"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { patchJson } from "@/lib/browser-api";

type GoalStatus = "active" | "achieved" | "abandoned";

interface MutationBody {
  error?: string;
}

const STATUS_OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "achieved", label: "Achieved" },
  { value: "abandoned", label: "Abandoned" },
];

const selectClass =
  "rounded-md border border-gray-500 px-2 py-1 text-xs text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

/**
 * Phase 9 Today depth slice (goals): the inline status control on a goal
 * row. Moving a goal to achieved/abandoned goes through the PATCH route and
 * refreshes the Server Component so the row re-renders under its new pill -
 * and so the Today scorecard's "Goals achieved" count reflects it.
 */
export function GoalStatusControls({
  workspaceId,
  goalId,
  status,
}: {
  workspaceId: string;
  goalId: string;
  status: GoalStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function changeStatus(next: GoalStatus) {
    if (next === status) return;
    setPending(true);
    setError(undefined);
    try {
      const outcome = await patchJson<MutationBody>(
        `/api/workspaces/${workspaceId}/goals/${goalId}`,
        { status: next },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not change status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="sr-only" htmlFor={`status-${goalId}`}>
        Status
      </label>
      <select
        id={`status-${goalId}`}
        value={status}
        onChange={(event) => changeStatus(event.target.value as GoalStatus)}
        disabled={pending}
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
