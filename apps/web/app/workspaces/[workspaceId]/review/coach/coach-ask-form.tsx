"use client";

import { useState } from "react";
import { Button } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface AskBody {
  answer?: string;
  followUpQuestion?: string | null;
  error?: string;
}

const textareaClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

/**
 * Phase 9 Review depth slice (coaching): the ask box for the AI coach. Sends
 * a question to /coaching/ask, which assembles the workspace context and
 * answers it. The answer is shown here, not persisted (coaching is
 * stateless), with the model's suggested follow-up offered as a one-click
 * next question. With no ANTHROPIC_API_KEY the route returns a labeled
 * placeholder answer (see the route), so the flow always works.
 */
export function CoachAskForm({ workspaceId }: { workspaceId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | undefined>();
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<AskBody>(`/api/workspaces/${workspaceId}/coaching/ask`, {
        question: trimmed,
      });
      if (!outcome.ok || typeof outcome.data.answer !== "string") {
        setError(outcome.data.error ?? "The coach couldn't answer that. Please try again.");
        return;
      }
      setAnswer(outcome.data.answer);
      setFollowUp(outcome.data.followUpQuestion ?? null);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await ask(question);
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-md border border-gray-500 p-4"
      >
        <label htmlFor="coach-question" className="text-sm font-medium text-gray-900">
          Ask the coach
        </label>
        <textarea
          id="coach-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={submitting}
          rows={3}
          maxLength={2000}
          placeholder="e.g. What should I focus on to hit my next goal?"
          className={textareaClass}
        />
        <div>
          <Button type="submit" disabled={submitting || question.trim().length === 0}>
            {submitting ? "Thinking..." : "Ask"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
      </form>

      {answer !== undefined && (
        <div className="flex flex-col gap-3 rounded-md border border-gray-500 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Answer</p>
          <p className="whitespace-pre-wrap text-sm text-gray-900">{answer}</p>
          {followUp !== null && (
            <div className="flex flex-col gap-1 border-t border-gray-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Suggested follow-up
              </p>
              <p className="text-sm text-gray-700">{followUp}</p>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => {
                    setQuestion(followUp);
                    void ask(followUp);
                  }}
                >
                  Ask this
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
