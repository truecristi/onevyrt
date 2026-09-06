"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import { patchJson } from "@/lib/browser-api";

interface MutationBody {
  error?: string;
}

const inputClass =
  "w-24 rounded-md border border-gray-500 px-2 py-1 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

/**
 * Phase 9 Today depth slice (metrics): the inline "log the latest value"
 * control on a metric row. Updating the current value is the recurring act
 * of tracking - it goes through the PATCH route and refreshes the Server
 * Component so the row's progress toward target re-renders.
 */
export function MetricValueControl({
  workspaceId,
  metricId,
  currentValue,
}: {
  workspaceId: string;
  metricId: string;
  currentValue: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentValue === null ? "" : currentValue.toString());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed === "") return;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setError("Enter a number.");
      return;
    }

    setPending(true);
    setError(undefined);
    try {
      const outcome = await patchJson<MutationBody>(
        `/api/workspaces/${workspaceId}/business-metrics/${metricId}`,
        { currentValue: parsed },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not update.");
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
    <form onSubmit={handleSubmit} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`current-${metricId}`}>
          Current value
        </label>
        <input
          id={`current-${metricId}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={pending}
          inputMode="decimal"
          placeholder="Current"
          className={inputClass}
        />
        <Button type="submit" variant="secondary" disabled={pending || value.trim() === ""}>
          {pending ? "..." : "Update"}
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
