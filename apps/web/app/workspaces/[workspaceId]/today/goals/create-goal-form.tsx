"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface CreateGoalBody {
  goal?: { id: string };
  error?: string;
}

const textareaClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

/**
 * Phase 9 Today depth slice (goals): the strategic targets the workspace is
 * working toward - what the Today scorecard's "Goals achieved N / M" is
 * counting. Built on the existing Phase 2 business-core goal domain and API
 * layer - no domain or API changes.
 */
export function CreateGoalForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateGoalBody>(`/api/workspaces/${workspaceId}/goals`, {
        title: title.trim(),
        description: description.trim(),
        ...(targetDate !== "" ? { targetDate: new Date(targetDate).toISOString() } : {}),
      });
      if (!outcome.ok || !outcome.data.goal) {
        setError(outcome.data.error ?? "Could not save the goal. Please try again.");
        return;
      }
      setTitle("");
      setDescription("");
      setTargetDate("");
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
      <p className="text-sm font-semibold text-gray-900">Set a goal</p>
      <Input
        label="Goal"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={submitting}
        maxLength={200}
        placeholder="e.g. Reach $10k MRR"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="goal-description" className="text-sm font-medium text-gray-900">
          Description (optional)
        </label>
        <textarea
          id="goal-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={submitting}
          rows={2}
          maxLength={2000}
          placeholder="What does hitting this look like?"
          className={textareaClass}
        />
      </div>
      <Input
        label="Target date (optional)"
        type="date"
        value={targetDate}
        onChange={(event) => setTargetDate(event.target.value)}
        disabled={submitting}
      />
      <div>
        <Button type="submit" disabled={submitting || title.trim().length === 0}>
          {submitting ? "Saving..." : "Set goal"}
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
