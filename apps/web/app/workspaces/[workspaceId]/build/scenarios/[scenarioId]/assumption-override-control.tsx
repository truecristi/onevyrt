"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import { postJson, deleteWithCsrf } from "@/lib/browser-api";

interface MutationBody {
  error?: string;
}

const inputClass =
  "w-24 rounded-md border border-gray-500 px-2 py-1 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

/**
 * Phase 9 Build depth slice (scenarios): the per-assumption override control
 * on a scenario's detail. Setting a value overrides just this assumption for
 * this scenario (the baseline is never touched); resetting removes the
 * override so the assumption falls back to its baseline. Both go through the
 * scenario-overrides routes and refresh the Server Component so the resolved
 * value re-renders.
 */
export function AssumptionOverrideControl({
  workspaceId,
  scenarioId,
  assumptionId,
  scenarioValue,
  isOverridden,
}: {
  workspaceId: string;
  scenarioId: string;
  assumptionId: string;
  scenarioValue: number | null;
  isOverridden: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(scenarioValue === null ? "" : scenarioValue.toString());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function setOverride(event: React.FormEvent) {
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
      const outcome = await postJson<MutationBody>(
        `/api/workspaces/${workspaceId}/scenarios/${scenarioId}/overrides`,
        { assumptionId, value: parsed },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not set the override.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function reset() {
    setPending(true);
    setError(undefined);
    try {
      const outcome = await deleteWithCsrf<MutationBody>(
        `/api/workspaces/${workspaceId}/scenarios/${scenarioId}/overrides/${assumptionId}`,
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not reset the override.");
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
      <form onSubmit={setOverride} className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`override-${assumptionId}`}>
          Scenario value
        </label>
        <input
          id={`override-${assumptionId}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={pending}
          inputMode="decimal"
          className={inputClass}
        />
        <Button type="submit" variant="secondary" disabled={pending || value.trim() === ""}>
          {pending ? "..." : "Override"}
        </Button>
        {isOverridden && (
          <Button type="button" variant="secondary" disabled={pending} onClick={reset}>
            Reset
          </Button>
        )}
      </form>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
