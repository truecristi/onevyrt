"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { patchJson, putJson } from "@/lib/browser-api";

type TaskStatus = "open" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface MutationBody {
  error?: string;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const selectClass =
  "rounded-md border border-gray-500 px-2 py-1 text-xs text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

/**
 * Phase 9 Execute slice: the inline controls on a task row. Status goes
 * through the dedicated PATCH route (which sets/clears completedAt
 * server-side); priority goes through the PUT route. Both refresh the
 * Server Component so the task re-renders under its new status group /
 * badge. A failed change reverts the select to the last-known value
 * rather than lying about a change that didn't land.
 */
export function TaskControls({
  workspaceId,
  taskId,
  status,
  priority,
}: {
  workspaceId: string;
  taskId: string;
  status: TaskStatus;
  priority: TaskPriority;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function changeStatus(next: TaskStatus) {
    if (next === status) return;
    setPending(true);
    setError(undefined);
    try {
      const outcome = await patchJson<MutationBody>(
        `/api/workspaces/${workspaceId}/tasks/${taskId}`,
        { status: next },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not change status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function changePriority(next: TaskPriority) {
    if (next === priority) return;
    setPending(true);
    setError(undefined);
    try {
      const outcome = await putJson<MutationBody>(
        `/api/workspaces/${workspaceId}/tasks/${taskId}`,
        { priority: next },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not change priority.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`status-${taskId}`}>
          Status
        </label>
        <select
          id={`status-${taskId}`}
          value={status}
          onChange={(event) => changeStatus(event.target.value as TaskStatus)}
          disabled={pending}
          className={selectClass}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`priority-${taskId}`}>
          Priority
        </label>
        <select
          id={`priority-${taskId}`}
          value={priority}
          onChange={(event) => changePriority(event.target.value as TaskPriority)}
          disabled={pending}
          className={selectClass}
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
