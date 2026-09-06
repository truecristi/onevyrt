"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import type { LaunchStatus, LaunchChecklistItem } from "@onevyrt/contracts";
import { patchJson } from "@/lib/browser-api";

export interface EditableLaunch {
  name: string;
  status: LaunchStatus;
  /** ISO string or null (as the API serializes launchDate). */
  launchDate: string | null;
  notes: string;
  checklist: LaunchChecklistItem[];
}

interface UpdateLaunchBody {
  error?: string;
}

const STATUS_OPTIONS: { value: LaunchStatus; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const fieldClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

function updateAt<T>(arr: T[], index: number, patch: Partial<T>): T[] {
  return arr.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function removeAt<T>(arr: T[], index: number): T[] {
  return arr.filter((_, i) => i !== index);
}

/** ISO string -> "YYYY-MM-DD" for a date input; "" when null/unparseable. */
function toDateInput(iso: string | null): string {
  if (iso === null) return "";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

/**
 * Phase 9 Execute depth slice (launches): edits a launch across its whole
 * shape - name, status, launch date, notes, and the checklist. The
 * checklist is a whole-list-replacement field on updateLaunch (like offers'
 * arrays), so this always sends the complete list, dropping blank-label
 * rows. offerId linking is out of this slice's scope, so the form never
 * sends it.
 */
export function LaunchEditForm({
  workspaceId,
  launchId,
  launch,
}: {
  workspaceId: string;
  launchId: string;
  launch: EditableLaunch;
}) {
  const router = useRouter();
  const statusId = useId();
  const dateId = useId();
  const [name, setName] = useState(launch.name);
  const [status, setStatus] = useState<LaunchStatus>(launch.status);
  const [launchDate, setLaunchDate] = useState(toDateInput(launch.launchDate));
  const [notes, setNotes] = useState(launch.notes);
  const [checklist, setChecklist] = useState<LaunchChecklistItem[]>(launch.checklist);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  function touched() {
    setSaved(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return;

    const cleanChecklist = checklist
      .map((item) => ({ label: item.label.trim(), done: item.done }))
      .filter((item) => item.label.length > 0);

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await patchJson<UpdateLaunchBody>(
        `/api/workspaces/${workspaceId}/launches/${launchId}`,
        {
          name: name.trim(),
          status,
          launchDate: launchDate === "" ? null : new Date(launchDate).toISOString(),
          notes: notes.trim(),
          checklist: cleanChecklist,
        },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not save the launch. Please try again.");
        return;
      }
      setChecklist(cleanChecklist);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const doneCount = checklist.filter((item) => item.done).length;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Launch name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          touched();
        }}
        disabled={submitting}
        required
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={statusId} className="text-sm font-medium text-gray-900">
            Status
          </label>
          <select
            id={statusId}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as LaunchStatus);
              touched();
            }}
            disabled={submitting}
            className={fieldClass}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={dateId} className="text-sm font-medium text-gray-900">
            Launch date
          </label>
          <input
            id={dateId}
            type="date"
            value={launchDate}
            onChange={(event) => {
              setLaunchDate(event.target.value);
              touched();
            }}
            disabled={submitting}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="launch-notes" className="text-sm font-medium text-gray-900">
          Notes
        </label>
        <textarea
          id="launch-notes"
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            touched();
          }}
          disabled={submitting}
          rows={3}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-900">
          Checklist{" "}
          {checklist.length > 0 && (
            <span className="text-xs font-normal text-gray-500">
              ({doneCount}/{checklist.length} done)
            </span>
          )}
        </p>
        {checklist.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={`Checklist item ${index + 1} done`}
              checked={item.done}
              onChange={(event) => {
                setChecklist((current) => updateAt(current, index, { done: event.target.checked }));
                touched();
              }}
              disabled={submitting}
              className="h-4 w-4"
            />
            <input
              aria-label={`Checklist item ${index + 1} label`}
              value={item.label}
              onChange={(event) => {
                setChecklist((current) => updateAt(current, index, { label: event.target.value }));
                touched();
              }}
              disabled={submitting}
              placeholder="Checklist item"
              maxLength={200}
              className={fieldClass}
            />
            <button
              type="button"
              onClick={() => {
                setChecklist((current) => removeAt(current, index));
                touched();
              }}
              disabled={submitting}
              className="shrink-0 text-xs text-red-700 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setChecklist((current) => [...current, { label: "", done: false }]);
              touched();
            }}
            disabled={submitting}
          >
            Add checklist item
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Saving..." : "Save changes"}
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
