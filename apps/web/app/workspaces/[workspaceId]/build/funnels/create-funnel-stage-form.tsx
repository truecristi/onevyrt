"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface CreateStageBody {
  stage?: { id: string };
  error?: string;
}

/**
 * Phase 9 Build depth slice (funnels): add one funnel stage - a name, its
 * position (orderIndex, 0 = top of funnel), and the conversion rate that
 * maps the previous stage's volume into this one (0-1). The top stage
 * needs no rate; every stage below one does, for the requirements
 * calculation to run. Conversion rate is set here at create time; to change
 * it, remove the stage and re-add it (inline editing is a later slice).
 */
export function CreateFunnelStageForm({
  workspaceId,
  nextOrderIndex,
}: {
  workspaceId: string;
  nextOrderIndex: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [orderIndex, setOrderIndex] = useState(String(nextOrderIndex));
  const [conversionRate, setConversionRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return;

    const order = Number(orderIndex);
    if (!Number.isInteger(order) || order < 0) {
      setError("Position must be a whole number, 0 or greater.");
      return;
    }

    let rate: number | undefined;
    if (conversionRate.trim() !== "") {
      rate = Number(conversionRate);
      if (Number.isNaN(rate) || rate <= 0 || rate > 1) {
        setError("Conversion rate must be between 0 and 1 (e.g. 0.25 for 25%).");
        return;
      }
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateStageBody>(
        `/api/workspaces/${workspaceId}/funnel-stages`,
        {
          name: name.trim(),
          orderIndex: order,
          ...(rate !== undefined ? { conversionRate: rate } : {}),
        },
      );
      if (!outcome.ok || !outcome.data.stage) {
        setError(outcome.data.error ?? "Could not add the stage. Please try again.");
        return;
      }
      setName("");
      setOrderIndex(String(order + 1));
      setConversionRate("");
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
      <p className="text-sm font-semibold text-gray-900">Add funnel stage</p>
      <Input
        label="Stage name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={submitting}
        required
        placeholder="e.g. Landing page visit"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Position"
          type="number"
          min="0"
          step="1"
          value={orderIndex}
          onChange={(event) => setOrderIndex(event.target.value)}
          disabled={submitting}
          hint="0 = top of funnel; higher = further down."
        />
        <Input
          label="Conversion rate (optional)"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={conversionRate}
          onChange={(event) => setConversionRate(event.target.value)}
          disabled={submitting}
          hint="0-1, e.g. 0.25 for 25%. Leave blank for the top stage."
        />
      </div>
      <div>
        <Button type="submit" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Adding..." : "Add stage"}
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
