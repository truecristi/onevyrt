"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface CreateExperimentBody {
  experiment?: { id: string };
  error?: string;
}

const textareaClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Phase 9 Execute depth slice (experiments): a minimal quick-create - a
 * name plus the hypothesis it tests - so the Execute page has a
 * low-friction way to start an experiment. Method, status transitions,
 * result and decision are filled in on the experiment's own detail page
 * afterward, the same "create small, flesh out on detail" shape the
 * offers/customer-profiles forms use.
 */
export function CreateExperimentForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateExperimentBody>(
        `/api/workspaces/${workspaceId}/experiments`,
        { name: name.trim(), hypothesis: hypothesis.trim() },
      );
      if (!outcome.ok || !outcome.data.experiment) {
        setError(outcome.data.error ?? "Could not create the experiment. Please try again.");
        return;
      }
      setName("");
      setHypothesis("");
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
      <p className="text-sm font-semibold text-gray-900">New experiment</p>
      <Input
        label="Experiment name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={submitting}
        required
        placeholder="e.g. Cold-email subject-line test"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="new-experiment-hypothesis" className="text-sm font-medium text-gray-900">
          Hypothesis (optional)
        </label>
        <textarea
          id="new-experiment-hypothesis"
          value={hypothesis}
          onChange={(event) => setHypothesis(event.target.value)}
          disabled={submitting}
          rows={2}
          placeholder="What you expect to happen, and why."
          className={textareaClass}
        />
      </div>
      <div>
        <Button type="submit" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Creating..." : "Create experiment"}
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
