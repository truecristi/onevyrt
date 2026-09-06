"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { patchJson } from "@/lib/browser-api";

type AssumptionStatus = "unvalidated" | "validated" | "invalidated";

interface MutationBody {
  error?: string;
}

const STATUS_OPTIONS: { value: AssumptionStatus; label: string }[] = [
  { value: "unvalidated", label: "Unvalidated" },
  { value: "validated", label: "Validated" },
  { value: "invalidated", label: "Invalidated" },
];

const selectClass =
  "rounded-md border border-gray-500 px-2 py-1 text-xs text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

/**
 * Phase 9 Build depth slice (assumptions): the inline status control on an
 * assumption row. Moving an assumption to validated/invalidated is how a
 * business records that a belief was tested - it goes through the PATCH
 * route and refreshes the Server Component so the row re-renders under its
 * new status pill.
 */
export function AssumptionStatusControls({
  workspaceId,
  assumptionId,
  status,
}: {
  workspaceId: string;
  assumptionId: string;
  status: AssumptionStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function changeStatus(next: AssumptionStatus) {
    if (next === status) return;
    setPending(true);
    setError(undefined);
    try {
      const outcome = await patchJson<MutationBody>(
        `/api/workspaces/${workspaceId}/assumptions/${assumptionId}`,
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
      <label className="sr-only" htmlFor={`status-${assumptionId}`}>
        Status
      </label>
      <select
        id={`status-${assumptionId}`}
        value={status}
        onChange={(event) => changeStatus(event.target.value as AssumptionStatus)}
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
