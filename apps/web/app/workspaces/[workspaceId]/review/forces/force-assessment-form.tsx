"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import type { Force, AssumptionConfidence } from "@onevyrt/contracts";
import { postJson } from "@/lib/browser-api";

interface UpsertBody {
  assessment?: { id: string };
  error?: string;
}

export const FORCE_OPTIONS: { value: Force; label: string }[] = [
  { value: "owner_psychology", label: "Owner psychology" },
  { value: "vision_planning", label: "Vision & planning" },
  { value: "sales_marketing", label: "Sales & marketing" },
  { value: "people_culture", label: "People & culture" },
  { value: "operations_systems", label: "Operations & systems" },
  { value: "finance_measurement", label: "Finance & measurement" },
  { value: "customer_experience", label: "Customer experience" },
];

const CONFIDENCE_OPTIONS: { value: AssumptionConfidence; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const fieldClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Phase 9 Review depth slice (Seven Forces): assess one force. The endpoint
 * is an upsert - one assessment per force per workspace - so re-submitting a
 * force overwrites its previous assessment, and the constraint diagnosis
 * re-ranks on the next render.
 */
export function ForceAssessmentForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const forceId = useId();
  const confidenceId = useId();
  const [force, setForce] = useState<Force>("sales_marketing");
  const [score, setScore] = useState("");
  const [target, setTarget] = useState("");
  const [confidence, setConfidence] = useState<AssumptionConfidence>("medium");
  const [constraintNote, setConstraintNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const scoreValue = Number(score);
    if (!Number.isInteger(scoreValue) || scoreValue < 0 || scoreValue > 100) {
      setError("Score must be a whole number from 0 to 100.");
      return;
    }
    let targetValue: number | undefined;
    if (target.trim() !== "") {
      targetValue = Number(target);
      if (!Number.isInteger(targetValue) || targetValue < 0 || targetValue > 100) {
        setError("Target must be a whole number from 0 to 100.");
        return;
      }
    }

    setSubmitting(true);
    setError(undefined);
    setSaved(false);
    try {
      const outcome = await postJson<UpsertBody>(
        `/api/workspaces/${workspaceId}/force-assessments`,
        {
          force,
          score: scoreValue,
          confidence,
          constraintNote: constraintNote.trim(),
          ...(targetValue !== undefined ? { target: targetValue } : {}),
        },
      );
      if (!outcome.ok || !outcome.data.assessment) {
        setError(outcome.data.error ?? "Could not save the assessment. Please try again.");
        return;
      }
      setSaved(true);
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
      <p className="text-sm font-semibold text-gray-900">Assess a force</p>
      <div className="flex flex-col gap-1">
        <label htmlFor={forceId} className="text-sm font-medium text-gray-900">
          Force
        </label>
        <select
          id={forceId}
          value={force}
          onChange={(event) => {
            setForce(event.target.value as Force);
            setSaved(false);
          }}
          disabled={submitting}
          className={fieldClass}
        >
          {FORCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Score (0-100)"
          type="number"
          min="0"
          max="100"
          step="1"
          value={score}
          onChange={(event) => {
            setScore(event.target.value);
            setSaved(false);
          }}
          disabled={submitting}
          required
        />
        <Input
          label="Target (optional)"
          type="number"
          min="0"
          max="100"
          step="1"
          value={target}
          onChange={(event) => {
            setTarget(event.target.value);
            setSaved(false);
          }}
          disabled={submitting}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor={confidenceId} className="text-sm font-medium text-gray-900">
            Confidence
          </label>
          <select
            id={confidenceId}
            value={confidence}
            onChange={(event) => {
              setConfidence(event.target.value as AssumptionConfidence);
              setSaved(false);
            }}
            disabled={submitting}
            className={fieldClass}
          >
            {CONFIDENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="force-constraint-note" className="text-sm font-medium text-gray-900">
          Constraint note (optional)
        </label>
        <textarea
          id="force-constraint-note"
          value={constraintNote}
          onChange={(event) => {
            setConstraintNote(event.target.value);
            setSaved(false);
          }}
          disabled={submitting}
          rows={2}
          placeholder="Why this force is (or isn't) holding you back."
          className={fieldClass}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || score.trim() === ""}>
          {submitting ? "Saving..." : "Save assessment"}
        </Button>
        {saved && !error && <span className="text-sm text-green-700">Saved.</span>}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
