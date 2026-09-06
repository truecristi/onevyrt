"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface CreateLaunchBody {
  launch?: { id: string };
  error?: string;
}

/**
 * Phase 9 Execute depth slice (launches): a minimal quick-create - just a
 * name - so the Execute page has a low-friction way to start a launch. The
 * date, notes and checklist are filled in on the launch's own detail page
 * afterward, the same "create small, flesh out on detail" shape the offers
 * and experiments forms use. A new launch starts in "planning".
 */
export function CreateLaunchForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateLaunchBody>(`/api/workspaces/${workspaceId}/launches`, {
        name: name.trim(),
      });
      if (!outcome.ok || !outcome.data.launch) {
        setError(outcome.data.error ?? "Could not create the launch. Please try again.");
        return;
      }
      setName("");
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
      <p className="text-sm font-semibold text-gray-900">New launch</p>
      <Input
        label="Launch name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={submitting}
        required
        placeholder="e.g. Spring cohort launch"
      />
      <div>
        <Button type="submit" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Creating..." : "Create launch"}
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
