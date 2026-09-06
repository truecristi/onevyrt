"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface EnrollErrorBody {
  error?: string;
}

/**
 * Phase 9 Learn slice: shared client island for every "Enroll" action
 * (program list, program detail, and a not-yet-enrolled prompt on the
 * lesson page all need the same button). Posts to the existing
 * POST /api/enrollments route (Phase 3) - no new backend surface needed
 * for this slice.
 */
export function EnrollButton({ programVersionId }: { programVersionId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleEnroll() {
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await postJson<EnrollErrorBody>("/api/enrollments", { programVersionId });
      if (result.ok) {
        router.refresh();
        return;
      }
      // AlreadyEnrolledError (409) still means the desired end state is
      // reached - refresh rather than surface it as a failure.
      if (result.status === 409) {
        router.refresh();
        return;
      }
      setError(result.data.error ?? "Could not enroll. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleEnroll} disabled={submitting}>
        {submitting ? "Enrolling..." : "Enroll"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
