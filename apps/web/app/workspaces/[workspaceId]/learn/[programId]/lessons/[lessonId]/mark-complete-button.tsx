"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import { patchJson } from "@/lib/browser-api";

interface MissingRequirement {
  lessonBlockId: string;
  blockType: string;
  reason: string;
}

interface UpdateProgressBody {
  error?: string;
  missing?: MissingRequirement[];
}

/**
 * "Completion is based on accepted outputs and evidence, not time
 * watched" (spec section 3.4, LessonCompletionRequirementsNotMetError's
 * doc comment) - a 409 here is an expected, honest outcome (an unanswered
 * knowledge check above, say), not a failure to swallow silently.
 */
export function MarkCompleteButton({
  enrollmentId,
  lessonId,
  nextLessonHref,
}: {
  enrollmentId: string;
  lessonId: string;
  nextLessonHref?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [missing, setMissing] = useState<MissingRequirement[]>([]);

  async function handleComplete() {
    setSubmitting(true);
    setError(undefined);
    setMissing([]);
    try {
      const outcome = await patchJson<UpdateProgressBody>(
        `/api/enrollments/${enrollmentId}/lessons/${lessonId}/progress`,
        { status: "completed" },
      );
      if (!outcome.ok) {
        if (outcome.status === 409 && outcome.data.missing) {
          setMissing(outcome.data.missing);
          return;
        }
        setError(outcome.data.error ?? "Could not mark this lesson complete. Please try again.");
        return;
      }
      router.refresh();
      if (nextLessonHref) {
        router.push(nextLessonHref);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleComplete} disabled={submitting}>
        {submitting ? "Marking complete..." : "Mark lesson complete"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {missing.length > 0 && (
        <div role="alert" className="max-w-sm text-right text-xs text-red-700">
          <p>Finish these before completing the lesson:</p>
          <ul className="list-inside list-disc">
            {missing.map((item) => (
              <li key={item.lessonBlockId}>{item.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
