"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@onevyrt/contracts";
import { patchJson } from "@/lib/browser-api";

interface UpdateProjectBody {
  error?: string;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const selectClass =
  "rounded-md border border-gray-500 px-2 py-1 text-xs text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Phase 9 Execute depth slice (projects): moves one project between
 * active / completed / archived. Only ever sends the status.
 */
export function ProjectStatusControls({
  workspaceId,
  projectId,
  status,
}: {
  workspaceId: string;
  projectId: string;
  status: ProjectStatus;
}) {
  const router = useRouter();
  const selectId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleChange(next: ProjectStatus) {
    if (next === status) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await patchJson<UpdateProjectBody>(
        `/api/workspaces/${workspaceId}/projects/${projectId}`,
        { status: next },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not update.");
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
      <label htmlFor={selectId} className="sr-only">
        Project status
      </label>
      <select
        id={selectId}
        value={status}
        onChange={(event) => handleChange(event.target.value as ProjectStatus)}
        disabled={submitting}
        className={selectClass}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
