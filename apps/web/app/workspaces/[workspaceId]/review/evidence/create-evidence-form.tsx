"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import type { EvidenceStrength } from "@onevyrt/contracts";
import { postJson } from "@/lib/browser-api";

interface CreateEvidenceBody {
  evidence?: { id: string };
  error?: string;
}

const STRENGTH_OPTIONS: { value: EvidenceStrength; label: string }[] = [
  { value: "weak", label: "Weak" },
  { value: "moderate", label: "Moderate" },
  { value: "strong", label: "Strong" },
];

const fieldClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Phase 9 Review depth slice (evidence): record a piece of evidence - a
 * title, an optional description and source link, and how strong it is.
 * Linking evidence to a specific assumption/decision/experiment is a later
 * slice, so this form collects the standalone record.
 */
export function CreateEvidenceForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const strengthId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [strength, setStrength] = useState<EvidenceStrength>("moderate");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateEvidenceBody>(
        `/api/workspaces/${workspaceId}/evidence`,
        {
          title: title.trim(),
          description: description.trim(),
          sourceUrl: sourceUrl.trim(),
          strength,
        },
      );
      if (!outcome.ok || !outcome.data.evidence) {
        setError(outcome.data.error ?? "Could not record the evidence. Please try again.");
        return;
      }
      setTitle("");
      setDescription("");
      setSourceUrl("");
      setStrength("moderate");
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
      <p className="text-sm font-semibold text-gray-900">Record evidence</p>
      <Input
        label="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={submitting}
        required
        placeholder="e.g. 12 of 20 interviews named pricing as the blocker"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="new-evidence-description" className="text-sm font-medium text-gray-900">
          Description (optional)
        </label>
        <textarea
          id="new-evidence-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={submitting}
          rows={2}
          placeholder="What this evidence is and what it shows."
          className={fieldClass}
        />
      </div>
      <Input
        label="Source URL (optional)"
        value={sourceUrl}
        onChange={(event) => setSourceUrl(event.target.value)}
        disabled={submitting}
        placeholder="https://..."
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={strengthId} className="text-sm font-medium text-gray-900">
          Strength
        </label>
        <select
          id={strengthId}
          value={strength}
          onChange={(event) => setStrength(event.target.value as EvidenceStrength)}
          disabled={submitting}
          className={fieldClass}
        >
          {STRENGTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Button type="submit" disabled={submitting || title.trim().length === 0}>
          {submitting ? "Saving..." : "Record evidence"}
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
