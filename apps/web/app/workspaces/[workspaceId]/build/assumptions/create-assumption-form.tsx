"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface CreateAssumptionBody {
  assumption?: { id: string };
  error?: string;
}

const fieldClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

/**
 * Phase 9 Build depth slice (assumptions): the "what we're taking as given"
 * primitive behind the numbers - business assumptions with an optional
 * measured value, a unit, and a confidence level. Built on the existing
 * Phase 2/4 assumption domain and API layer - no domain or API changes.
 * These feed scenario modeling, funnel maths and the financial dashboards.
 */
export function CreateAssumptionForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [statement, setStatement] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [confidence, setConfidence] = useState<"low" | "medium" | "high">("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (statement.trim().length === 0) return;

    const trimmedValue = value.trim();
    let numericValue: number | undefined;
    if (trimmedValue !== "") {
      const parsed = Number(trimmedValue);
      if (!Number.isFinite(parsed)) {
        setError("Value must be a number.");
        return;
      }
      numericValue = parsed;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateAssumptionBody>(
        `/api/workspaces/${workspaceId}/assumptions`,
        {
          statement: statement.trim(),
          unit: unit.trim(),
          confidence,
          ...(numericValue !== undefined ? { value: numericValue } : {}),
        },
      );
      if (!outcome.ok || !outcome.data.assumption) {
        setError(outcome.data.error ?? "Could not save the assumption. Please try again.");
        return;
      }
      setStatement("");
      setValue("");
      setUnit("");
      setConfidence("medium");
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
      <p className="text-sm font-semibold text-gray-900">Add an assumption</p>
      <Input
        label="Assumption"
        value={statement}
        onChange={(event) => setStatement(event.target.value)}
        disabled={submitting}
        maxLength={500}
        placeholder="e.g. Cold email reply rate is 3%"
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            label="Value (optional)"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={submitting}
            inputMode="decimal"
            placeholder="e.g. 3"
          />
        </div>
        <div className="flex-1">
          <Input
            label="Unit (optional)"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            disabled={submitting}
            maxLength={20}
            placeholder="e.g. %"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="assumption-confidence" className="text-sm font-medium text-gray-900">
          Confidence
        </label>
        <select
          id="assumption-confidence"
          value={confidence}
          onChange={(event) => setConfidence(event.target.value as "low" | "medium" | "high")}
          disabled={submitting}
          className={fieldClass}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div>
        <Button type="submit" disabled={submitting || statement.trim().length === 0}>
          {submitting ? "Saving..." : "Add assumption"}
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
