"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface SubmitResponseBody {
  error?: string;
}

export function ReflectionBlock({
  enrollmentId,
  lessonBlockId,
  prompt,
  collectConfidenceRating,
  initialResponse,
}: {
  enrollmentId: string;
  lessonBlockId: string;
  prompt: string;
  collectConfidenceRating: boolean;
  initialResponse?: { text: string; confidenceRating?: number };
}) {
  const router = useRouter();
  const textId = useId();
  const confidenceId = useId();
  const [text, setText] = useState(initialResponse?.text ?? "");
  const [confidenceRating, setConfidenceRating] = useState<number | undefined>(
    initialResponse?.confidenceRating,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(Boolean(initialResponse));

  async function handleSubmit() {
    if (text.trim().length === 0) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<SubmitResponseBody>(
        `/api/enrollments/${enrollmentId}/blocks/${lessonBlockId}/response`,
        {
          blockType: "reflection",
          response: {
            text: text.trim(),
            ...(confidenceRating !== undefined ? { confidenceRating } : {}),
          },
        },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not save your reflection. Please try again.");
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
    <div className="flex flex-col gap-3 rounded-md border border-gray-500 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reflection</p>
      <label htmlFor={textId} className="text-sm font-medium text-gray-900">
        {prompt}
      </label>
      <textarea
        id={textId}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setSaved(false);
        }}
        disabled={submitting}
        rows={4}
        className="w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      />
      {collectConfidenceRating && (
        <div className="flex flex-col gap-1">
          <label htmlFor={confidenceId} className="text-sm font-medium text-gray-900">
            Confidence (1-5)
          </label>
          <input
            id={confidenceId}
            type="number"
            min={1}
            max={5}
            value={confidenceRating ?? ""}
            onChange={(event) => {
              const value = event.target.value ? Number(event.target.value) : undefined;
              setConfidenceRating(value);
              setSaved(false);
            }}
            disabled={submitting}
            className="w-20 rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          />
        </div>
      )}
      <div>
        <Button onClick={handleSubmit} disabled={submitting || text.trim().length === 0}>
          {saved ? "Update reflection" : "Save reflection"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {saved && !error && <p className="text-sm text-green-700">Saved.</p>}
    </div>
  );
}
