"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface CreateProjectBody {
  project?: { id: string };
  error?: string;
}

const textareaClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Phase 9 Execute depth slice (projects): create a project - a name plus an
 * optional description. A new project starts "active"; its status is moved
 * on the list itself. Same "create here, manage in the list" shape the
 * tasks and decision-log surfaces use.
 */
export function CreateProjectForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateProjectBody>(`/api/workspaces/${workspaceId}/projects`, {
        name: name.trim(),
        description: description.trim(),
      });
      if (!outcome.ok || !outcome.data.project) {
        setError(outcome.data.error ?? "Could not create the project. Please try again.");
        return;
      }
      setName("");
      setDescription("");
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
      <p className="text-sm font-semibold text-gray-900">New project</p>
      <Input
        label="Project name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={submitting}
        required
        placeholder="e.g. Q3 launch"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="new-project-description" className="text-sm font-medium text-gray-900">
          Description (optional)
        </label>
        <textarea
          id="new-project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={submitting}
          rows={2}
          placeholder="What this project is about."
          className={textareaClass}
        />
      </div>
      <div>
        <Button type="submit" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Creating..." : "Create project"}
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
