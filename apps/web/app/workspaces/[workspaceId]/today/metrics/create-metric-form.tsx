"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface CreateMetricBody {
  metric?: { id: string };
  error?: string;
}

type Direction = "increase" | "decrease";
type Cadence = "weekly" | "monthly" | "quarterly";

const selectClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

/**
 * Phase 9 Today depth slice (metrics): the numbers the workspace tracks
 * toward a target - what the Today scorecard's "Metrics tracked" is
 * counting. Built on the existing Phase 2 business-metric domain and API
 * layer - no domain or API changes.
 */
export function CreateMetricForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [direction, setDirection] = useState<Direction>("increase");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function parseNumber(raw: string): number | undefined | null {
    const trimmed = raw.trim();
    if (trimmed === "") return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return;

    const baselineValue = parseNumber(baseline);
    const targetValue = parseNumber(target);
    const currentValue = parseNumber(current);
    if (baselineValue === null || targetValue === null || currentValue === null) {
      setError("Baseline, target and current must be numbers.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateMetricBody>(
        `/api/workspaces/${workspaceId}/business-metrics`,
        {
          name: name.trim(),
          unit: unit.trim(),
          direction,
          cadence,
          ...(baselineValue !== undefined ? { baselineValue } : {}),
          ...(targetValue !== undefined ? { targetValue } : {}),
          ...(currentValue !== undefined ? { currentValue } : {}),
        },
      );
      if (!outcome.ok || !outcome.data.metric) {
        setError(outcome.data.error ?? "Could not save the metric. Please try again.");
        return;
      }
      setName("");
      setUnit("");
      setDirection("increase");
      setCadence("monthly");
      setBaseline("");
      setTarget("");
      setCurrent("");
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
      <p className="text-sm font-semibold text-gray-900">Track a metric</p>
      <Input
        label="Metric"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={submitting}
        maxLength={200}
        placeholder="e.g. Monthly recurring revenue"
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            label="Unit (optional)"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            disabled={submitting}
            maxLength={20}
            placeholder="e.g. $"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="metric-direction" className="text-sm font-medium text-gray-900">
            Direction
          </label>
          <select
            id="metric-direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value as Direction)}
            disabled={submitting}
            className={selectClass}
          >
            <option value="increase">Increase</option>
            <option value="decrease">Decrease</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="metric-cadence" className="text-sm font-medium text-gray-900">
            Cadence
          </label>
          <select
            id="metric-cadence"
            value={cadence}
            onChange={(event) => setCadence(event.target.value as Cadence)}
            disabled={submitting}
            className={selectClass}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            label="Baseline (optional)"
            value={baseline}
            onChange={(event) => setBaseline(event.target.value)}
            disabled={submitting}
            inputMode="decimal"
          />
        </div>
        <div className="flex-1">
          <Input
            label="Current (optional)"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            disabled={submitting}
            inputMode="decimal"
          />
        </div>
        <div className="flex-1">
          <Input
            label="Target (optional)"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            disabled={submitting}
            inputMode="decimal"
          />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Saving..." : "Track metric"}
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
