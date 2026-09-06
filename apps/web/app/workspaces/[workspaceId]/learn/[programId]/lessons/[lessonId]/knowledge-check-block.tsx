"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface SubmitResponseBody {
  response?: { response?: { selectedOptionIndex: number; isCorrect: boolean } };
  error?: string;
}

/**
 * Phase 9 Learn slice: knowledge-check is graded server-side
 * (submitKnowledgeCheckResponse) - this component never receives or
 * computes correctOptionIndex itself. After a correct/incorrect answer,
 * router.refresh() re-renders the page's Server Component, which is the
 * only place that decides whether the block's explanation is now safe to
 * reveal (only once a response actually exists - see the lesson page's
 * sanitizeBlock).
 */
export function KnowledgeCheckBlock({
  enrollmentId,
  lessonBlockId,
  question,
  options,
  explanation,
  initialResponse,
}: {
  enrollmentId: string;
  lessonBlockId: string;
  question: string;
  options: string[];
  explanation?: string;
  initialResponse?: { selectedOptionIndex: number; isCorrect: boolean };
}) {
  const router = useRouter();
  const groupId = useId();
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | undefined>(
    initialResponse?.selectedOptionIndex,
  );
  const [result, setResult] = useState(initialResponse);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit() {
    if (selectedOptionIndex === undefined) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<SubmitResponseBody>(
        `/api/enrollments/${enrollmentId}/blocks/${lessonBlockId}/response`,
        { blockType: "knowledge-check", response: { selectedOptionIndex } },
      );
      if (!outcome.ok || !outcome.data.response?.response) {
        setError(outcome.data.error ?? "Could not submit your answer. Please try again.");
        return;
      }
      setResult(outcome.data.response.response);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-gray-500 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Knowledge check</p>
      <p className="font-medium text-gray-900">{question}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{question}</legend>
        {options.map((option, index) => (
          <label key={index} className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="radio"
              name={groupId}
              checked={selectedOptionIndex === index}
              onChange={() => setSelectedOptionIndex(index)}
              disabled={submitting}
            />
            {option}
          </label>
        ))}
      </fieldset>
      <div>
        <Button onClick={handleSubmit} disabled={submitting || selectedOptionIndex === undefined}>
          {result ? "Change answer" : "Submit answer"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {result && (
        <p
          className={`text-sm font-medium ${result.isCorrect ? "text-green-700" : "text-red-700"}`}
        >
          {result.isCorrect ? "Correct." : "Not quite."}
          {explanation && <span className="block font-normal text-gray-600">{explanation}</span>}
        </p>
      )}
    </div>
  );
}
