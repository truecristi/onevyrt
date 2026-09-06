"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface CreateDecisionBody {
  decision?: { id: string };
  error?: string;
}

const textareaClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Phase 9 Review depth slice (decision log): create a decision record - the
 * title, the context that led to it, and the outcome. A new decision starts
 * "proposed"; its status is moved on the list itself. Same "create here,
 * manage in the list" shape the tasks surface uses.
 */
export function CreateDecisionForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [outcome, setOutcome] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcomeResponse = await postJson<CreateDecisionBody>(
        `/api/workspaces/${workspaceId}/decisions`,
        { title: title.trim(), context: context.trim(), outcome: outcome.trim() },
      );
      if (!outcomeResponse.ok || !outcomeResponse.data.decision) {
        setError(outcomeResponse.data.error ?? "Could not record the decision. Please try again.");
        return;
      }
      setTitle("");
      setContext("");
      setOutcome("");
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
      <p className="text-sm font-semibold text-gray-900">Record a decision</p>
      <Input
        label="Decision"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={submitting}
        required
        placeholder="e.g. Focus on the SMB segment first"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="new-decision-context" className="text-sm font-medium text-gray-900">
          Context (optional)
        </label>
        <textarea
          id="new-decision-context"
          value={context}
          onChange={(event) => setContext(event.target.value)}
          disabled={submitting}
          rows={2}
          placeholder="What led to this decision."
          className={textareaClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-decision-outcome" className="text-sm font-medium text-gray-900">
          Outcome (optional)
        </label>
        <textarea
          id="new-decision-outcome"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
          disabled={submitting}
          rows={2}
          placeholder="What you expect to happen as a result."
          className={textareaClass}
        />
      </div>
      <div>
        <Button type="submit" disabled={submitting || title.trim().length === 0}>
          {submitting ? "Saving..." : "Record decision"}
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
