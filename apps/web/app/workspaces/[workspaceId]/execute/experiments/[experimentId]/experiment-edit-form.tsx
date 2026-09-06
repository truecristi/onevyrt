"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import type { ExperimentStatus, ExperimentDecision } from "@onevyrt/contracts";
import { patchJson } from "@/lib/browser-api";

export interface EditableExperiment {
  name: string;
  hypothesis: string;
  method: string;
  status: ExperimentStatus;
  result: string;
  decision: ExperimentDecision | null;
}

interface UpdateExperimentBody {
  error?: string;
}

const STATUS_OPTIONS: { value: ExperimentStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

const DECISION_OPTIONS: { value: ExperimentDecision; label: string }[] = [
  { value: "adopt", label: "Adopt" },
  { value: "iterate", label: "Iterate" },
  { value: "retest", label: "Retest" },
  { value: "stop", label: "Stop" },
  { value: "insufficient_evidence", label: "Insufficient evidence" },
  { value: "reject", label: "Reject" },
];

const fieldClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Phase 9 Execute depth slice (experiments): edits an experiment across its
 * whole loop - the plan (name, hypothesis, method), the status (which the
 * domain uses to stamp startedAt when it first becomes "running" and
 * endedAt when it first becomes "completed"/"abandoned"), and the outcome
 * (result plus the decision vocabulary from spec section 6.19). assumptionId
 * and ownerId links are out of this slice's scope, so this form never sends
 * them (updateExperiment treats an omitted field as "leave unchanged").
 */
export function ExperimentEditForm({
  workspaceId,
  experimentId,
  experiment,
}: {
  workspaceId: string;
  experimentId: string;
  experiment: EditableExperiment;
}) {
  const router = useRouter();
  const statusId = useId();
  const decisionId = useId();
  const [name, setName] = useState(experiment.name);
  const [hypothesis, setHypothesis] = useState(experiment.hypothesis);
  const [method, setMethod] = useState(experiment.method);
  const [status, setStatus] = useState<ExperimentStatus>(experiment.status);
  const [result, setResult] = useState(experiment.result);
  const [decision, setDecision] = useState<ExperimentDecision | "">(experiment.decision ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  function touched() {
    setSaved(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await patchJson<UpdateExperimentBody>(
        `/api/workspaces/${workspaceId}/experiments/${experimentId}`,
        {
          name: name.trim(),
          hypothesis: hypothesis.trim(),
          method: method.trim(),
          status,
          result: result.trim(),
          // "" clears the decision (null); a value sets it.
          decision: decision === "" ? null : decision,
        },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not save the experiment. Please try again.");
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Experiment name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          touched();
        }}
        disabled={submitting}
        required
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="experiment-hypothesis" className="text-sm font-medium text-gray-900">
          Hypothesis
        </label>
        <textarea
          id="experiment-hypothesis"
          value={hypothesis}
          onChange={(event) => {
            setHypothesis(event.target.value);
            touched();
          }}
          disabled={submitting}
          rows={2}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="experiment-method" className="text-sm font-medium text-gray-900">
          Method
        </label>
        <textarea
          id="experiment-method"
          value={method}
          onChange={(event) => {
            setMethod(event.target.value);
            touched();
          }}
          disabled={submitting}
          rows={2}
          className={fieldClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={statusId} className="text-sm font-medium text-gray-900">
            Status
          </label>
          <select
            id={statusId}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ExperimentStatus);
              touched();
            }}
            disabled={submitting}
            className={fieldClass}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={decisionId} className="text-sm font-medium text-gray-900">
            Decision
          </label>
          <select
            id={decisionId}
            value={decision}
            onChange={(event) => {
              setDecision(event.target.value as ExperimentDecision | "");
              touched();
            }}
            disabled={submitting}
            className={fieldClass}
          >
            <option value="">No decision yet</option>
            {DECISION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="experiment-result" className="text-sm font-medium text-gray-900">
          Result
        </label>
        <p className="text-xs text-gray-500">What actually happened once the experiment ran.</p>
        <textarea
          id="experiment-result"
          value={result}
          onChange={(event) => {
            setResult(event.target.value);
            touched();
          }}
          disabled={submitting}
          rows={3}
          className={fieldClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Saving..." : "Save changes"}
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
