"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface UpsertReviewBody {
  review?: { id: string };
  error?: string;
}

const fieldClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const TEXT_FIELDS: {
  key: "wins" | "challenges" | "focusNextWeek";
  label: string;
  placeholder: string;
}[] = [
  { key: "wins", label: "Wins", placeholder: "What went well this week?" },
  { key: "challenges", label: "Challenges", placeholder: "What got in the way?" },
  { key: "focusNextWeek", label: "Focus next week", placeholder: "What should happen next?" },
];

/**
 * Phase 9 Review slice: save (or revise) a weekly review. One review per
 * workspace per week - the server upserts on the week containing the
 * chosen date and re-freezes a fresh scorecard snapshot each save, so
 * saving again for the same week revises it rather than duplicating.
 */
export function CreateWeeklyReviewForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const weekOfId = useId();
  const [weekOf, setWeekOf] = useState(todayIso());
  const [fields, setFields] = useState({ wins: "", challenges: "", focusNextWeek: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  const hasContent =
    fields.wins.trim() !== "" ||
    fields.challenges.trim() !== "" ||
    fields.focusNextWeek.trim() !== "";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!weekOf || !hasContent) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<UpsertReviewBody>(
        `/api/workspaces/${workspaceId}/weekly-reviews`,
        {
          // The API's weekOf is a full ISO datetime; a date-only input
          // gives YYYY-MM-DD, so anchor it to UTC midnight of that day.
          // The server normalizes it to that week's Monday.
          weekOf: new Date(`${weekOf}T00:00:00Z`).toISOString(),
          wins: fields.wins.trim(),
          challenges: fields.challenges.trim(),
          focusNextWeek: fields.focusNextWeek.trim(),
        },
      );
      if (!outcome.ok || !outcome.data.review) {
        setError(outcome.data.error ?? "Could not save the review. Please try again.");
        return;
      }
      setFields({ wins: "", challenges: "", focusNextWeek: "" });
      setSaved(true);
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
      <p className="text-sm font-semibold text-gray-900">New weekly review</p>
      <div className="flex flex-col gap-1">
        <label htmlFor={weekOfId} className="text-sm font-medium text-gray-900">
          Week of
        </label>
        <input
          id={weekOfId}
          type="date"
          value={weekOf}
          onChange={(event) => {
            setWeekOf(event.target.value);
            setSaved(false);
          }}
          disabled={submitting}
          required
          className={fieldClass}
        />
        <span className="text-xs text-gray-500">
          Any day in the week - it&rsquo;s recorded against that week, and saving again revises it.
        </span>
      </div>

      {TEXT_FIELDS.map(({ key, label, placeholder }) => (
        <div key={key} className="flex flex-col gap-1">
          <label htmlFor={`review-${key}`} className="text-sm font-medium text-gray-900">
            {label}
          </label>
          <textarea
            id={`review-${key}`}
            value={fields[key]}
            onChange={(event) => {
              setFields((current) => ({ ...current, [key]: event.target.value }));
              setSaved(false);
            }}
            disabled={submitting}
            rows={2}
            placeholder={placeholder}
            className={fieldClass}
          />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || !hasContent}>
          {submitting ? "Saving..." : "Save weekly review"}
        </Button>
        {saved && !error && <span className="text-sm text-green-700">Saved.</span>}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
