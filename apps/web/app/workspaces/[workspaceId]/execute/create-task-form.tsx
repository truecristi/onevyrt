"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface CreateTaskBody {
  task?: { id: string };
  error?: string;
}

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const selectClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Phase 9 Execute slice: quick-create a task - title, priority and an
 * optional due date. Description, project, and blocker links are set
 * through other routes (or deferred to a later slice), the same
 * "create small" shape the Build offer create form uses.
 */
export function CreateTaskForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const priorityId = useId();
  const dueDateId = useId();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateTaskBody>(`/api/workspaces/${workspaceId}/tasks`, {
        title: title.trim(),
        priority,
        // The API's dueDate is a full ISO datetime; a date-only <input>
        // gives YYYY-MM-DD, so anchor it to UTC midnight of that day.
        ...(dueDate ? { dueDate: new Date(`${dueDate}T00:00:00Z`).toISOString() } : {}),
      });
      if (!outcome.ok || !outcome.data.task) {
        setError(outcome.data.error ?? "Could not create the task. Please try again.");
        return;
      }
      setTitle("");
      setPriority("medium");
      setDueDate("");
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
      <p className="text-sm font-semibold text-gray-900">New task</p>
      <Input
        label="Task title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={submitting}
        required
        placeholder="e.g. Draft the launch email"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={priorityId} className="text-sm font-medium text-gray-900">
            Priority
          </label>
          <select
            id={priorityId}
            value={priority}
            onChange={(event) => setPriority(event.target.value as (typeof PRIORITIES)[number])}
            disabled={submitting}
            className={selectClass}
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={dueDateId} className="text-sm font-medium text-gray-900">
            Due date (optional)
          </label>
          <input
            id={dueDateId}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            disabled={submitting}
            className={selectClass}
          />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={submitting || title.trim().length === 0}>
          {submitting ? "Creating..." : "Create task"}
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
