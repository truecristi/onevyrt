"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { patchJson } from "@/lib/browser-api";

export interface EditableCustomerProfile {
  name: string;
  description: string;
  painPoints: string;
  desiredOutcome: string;
  emotionalConsequence: string;
  uniqueMechanism: string;
  proof: string;
  callToAction: string;
  positioningStatement: string;
}

interface UpdateCustomerProfileBody {
  error?: string;
}

/**
 * Phase 9 Build slice (customer profiles): edits the full profile - the
 * "who you sell to" definition (pain, desired outcome, emotional
 * consequence) alongside the positioning tools (unique mechanism, proof,
 * call to action, positioning statement) that PRD-BUILD-002 groups here.
 * Every field except the name is optional copy, so the form always sends
 * the full set (updateCustomerProfile treats an omitted field as "leave
 * unchanged"; sending the current value is a harmless no-op).
 */
const TEXT_FIELDS: { key: keyof EditableCustomerProfile; label: string; hint?: string }[] = [
  { key: "description", label: "Description", hint: "A one-line summary of this customer." },
  { key: "painPoints", label: "Pain points", hint: "What's hurting them right now." },
  { key: "desiredOutcome", label: "Desired outcome", hint: "The result they actually want." },
  {
    key: "emotionalConsequence",
    label: "Emotional consequence",
    hint: "What the pain costs them beyond the practical.",
  },
  {
    key: "uniqueMechanism",
    label: "Unique mechanism",
    hint: "Why your approach works where others don't.",
  },
  { key: "proof", label: "Proof", hint: "Evidence that it works - results, testimonials, data." },
  {
    key: "callToAction",
    label: "Call to action",
    hint: "The one next step you want them to take.",
  },
  {
    key: "positioningStatement",
    label: "Positioning statement",
    hint: "How you want this customer to see you.",
  },
];

const textareaClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function CustomerProfileEditForm({
  workspaceId,
  customerProfileId,
  profile,
}: {
  workspaceId: string;
  customerProfileId: string;
  profile: EditableCustomerProfile;
}) {
  const router = useRouter();
  const [form, setForm] = useState<EditableCustomerProfile>(profile);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  function setField<K extends keyof EditableCustomerProfile>(
    key: K,
    value: EditableCustomerProfile[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.name.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await patchJson<UpdateCustomerProfileBody>(
        `/api/workspaces/${workspaceId}/customer-profiles/${customerProfileId}`,
        {
          name: form.name.trim(),
          description: form.description,
          painPoints: form.painPoints,
          desiredOutcome: form.desiredOutcome,
          emotionalConsequence: form.emotionalConsequence,
          uniqueMechanism: form.uniqueMechanism,
          proof: form.proof,
          callToAction: form.callToAction,
          positioningStatement: form.positioningStatement,
        },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not save the profile. Please try again.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Profile name"
        value={form.name}
        onChange={(event) => setField("name", event.target.value)}
        disabled={submitting}
        required
      />

      {TEXT_FIELDS.map(({ key, label, hint }) => (
        <div key={key} className="flex flex-col gap-1">
          <label htmlFor={`profile-${key}`} className="text-sm font-medium text-gray-900">
            {label}
          </label>
          {hint && <p className="text-xs text-gray-500">{hint}</p>}
          <textarea
            id={`profile-${key}`}
            value={form[key]}
            onChange={(event) => setField(key, event.target.value)}
            disabled={submitting}
            rows={key === "callToAction" ? 2 : 3}
            className={textareaClass}
          />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || form.name.trim().length === 0}>
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
