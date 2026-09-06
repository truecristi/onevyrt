"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import { deleteWithCsrf } from "@/lib/browser-api";

interface DeleteStageBody {
  error?: string;
}

/**
 * Phase 9 Build depth slice (funnels): removes one funnel stage. Deleting a
 * middle stage is allowed; the requirements walk simply re-links across the
 * gap using whatever conversion rates remain.
 */
export function DeleteFunnelStageButton({
  workspaceId,
  funnelStageId,
}: {
  workspaceId: string;
  funnelStageId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleDelete() {
    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await deleteWithCsrf<DeleteStageBody>(
        `/api/workspaces/${workspaceId}/funnel-stages/${funnelStageId}`,
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not remove.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="danger" onClick={handleDelete} disabled={submitting}>
        {submitting ? "Removing..." : "Remove"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
