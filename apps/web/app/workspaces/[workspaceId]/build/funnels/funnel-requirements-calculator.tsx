"use client";

import { useState } from "react";
import { Button, Input } from "@onevyrt/design-system";
import type { FunnelStageRequirement } from "@onevyrt/contracts";
import { postJson } from "@/lib/browser-api";

interface RequirementsBody {
  requirements?: FunnelStageRequirement[];
  error?: string;
}

const cellClass = "px-3 py-2 text-sm text-gray-900";
const headClass = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";

/**
 * Phase 9 Build depth slice (funnels): the deterministic funnel-requirements
 * calculation. Given a target at the final stage (e.g. "50 sales"), the
 * server walks the funnel backward through each stage's conversion rate to
 * the volume required at every earlier stage. It's a real calculation over
 * the stored stages, not an estimate - if a stage below the top is missing
 * its conversion rate the server says exactly which one, rather than
 * guessing.
 */
export function FunnelRequirementsCalculator({
  workspaceId,
  hasStages,
}: {
  workspaceId: string;
  hasStages: boolean;
}) {
  const [target, setTarget] = useState("");
  const [rows, setRows] = useState<FunnelStageRequirement[] | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const targetValue = Number(target);
    if (Number.isNaN(targetValue) || targetValue <= 0) {
      setError("Enter a target greater than 0.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<RequirementsBody>(
        `/api/workspaces/${workspaceId}/funnel-stages/requirements`,
        { targetAtFinalStage: targetValue },
      );
      if (!outcome.ok || !outcome.data.requirements) {
        setRows(undefined);
        setError(outcome.data.error ?? "Could not calculate. Please try again.");
        return;
      }
      setRows(outcome.data.requirements);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          label="Target at final stage"
          type="number"
          min="0"
          step="1"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          disabled={submitting || !hasStages}
          hint="How many you want at the last stage (e.g. 50 sales)."
        />
        <div>
          <Button type="submit" disabled={submitting || !hasStages || target.trim() === ""}>
            {submitting ? "Calculating..." : "Calculate requirements"}
          </Button>
        </div>
        {!hasStages && (
          <p className="text-xs text-gray-500">Add at least one funnel stage first.</p>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
      </form>

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-300">
                <th className={headClass}>Stage</th>
                <th className={headClass}>Conversion rate</th>
                <th className={headClass}>Required</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.stageId} className="border-b border-gray-200">
                  <td className={cellClass}>{row.name}</td>
                  <td className={cellClass}>
                    {row.conversionRate === null ? "-" : `${Math.round(row.conversionRate * 100)}%`}
                  </td>
                  <td className={cellClass}>
                    {Math.ceil(row.requiredCount).toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
