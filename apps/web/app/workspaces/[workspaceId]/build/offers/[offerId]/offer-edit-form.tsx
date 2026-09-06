"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { patchJson } from "@/lib/browser-api";
import { centsToDollars, dollarsToCents } from "../../format";

export interface EditableOffer {
  name: string;
  description: string;
  priceCents: number | null;
  currency: string;
  status: "draft" | "active" | "archived";
  problemStatement: string;
  desiredOutcome: string;
  positioningStatement: string;
  valueProposition: string;
  guarantee: string;
  riskReversal: string;
}

interface UpdateOfferBody {
  error?: string;
}

const TEXT_FIELDS: { key: keyof EditableOffer; label: string }[] = [
  { key: "description", label: "Description" },
  { key: "problemStatement", label: "Problem statement" },
  { key: "desiredOutcome", label: "Desired outcome" },
  { key: "positioningStatement", label: "Positioning statement" },
  { key: "valueProposition", label: "Value proposition" },
  { key: "guarantee", label: "Guarantee" },
  { key: "riskReversal", label: "Risk reversal" },
];

const textareaClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Phase 9 Build slice: edits an offer's scalar copy fields plus its
 * status and price. The offer's component/bonus/objection lists are shown
 * read-only on the detail page and deliberately not editable here yet -
 * their array-editor UI is a later Build slice, so this form never sends
 * those fields (updateOffer treats an omitted field as "leave unchanged").
 */
export function OfferEditForm({
  workspaceId,
  offerId,
  offer,
}: {
  workspaceId: string;
  offerId: string;
  offer: EditableOffer;
}) {
  const router = useRouter();
  const statusId = useId();
  const currencyId = useId();
  const [form, setForm] = useState<EditableOffer>(offer);
  const [price, setPrice] = useState(centsToDollars(offer.priceCents));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  function setField<K extends keyof EditableOffer>(key: K, value: EditableOffer[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.name.trim().length === 0) return;

    const priceCents = dollarsToCents(price);
    if (Number.isNaN(priceCents)) {
      setError("Price must be a number, e.g. 49 or 49.99.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await patchJson<UpdateOfferBody>(
        `/api/workspaces/${workspaceId}/offers/${offerId}`,
        {
          name: form.name.trim(),
          description: form.description,
          priceCents,
          currency: form.currency,
          status: form.status,
          problemStatement: form.problemStatement,
          desiredOutcome: form.desiredOutcome,
          positioningStatement: form.positioningStatement,
          valueProposition: form.valueProposition,
          guarantee: form.guarantee,
          riskReversal: form.riskReversal,
        },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not save the offer. Please try again.");
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
        label="Offer name"
        value={form.name}
        onChange={(event) => setField("name", event.target.value)}
        disabled={submitting}
        required
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label="Price"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => {
            setPrice(event.target.value);
            setSaved(false);
          }}
          disabled={submitting}
          hint="In dollars. Blank clears it."
        />
        <div className="flex flex-col gap-1">
          <label htmlFor={currencyId} className="text-sm font-medium text-gray-900">
            Currency
          </label>
          <input
            id={currencyId}
            value={form.currency}
            onChange={(event) => setField("currency", event.target.value)}
            disabled={submitting}
            maxLength={3}
            className={textareaClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={statusId} className="text-sm font-medium text-gray-900">
            Status
          </label>
          <select
            id={statusId}
            value={form.status}
            onChange={(event) => setField("status", event.target.value as EditableOffer["status"])}
            disabled={submitting}
            className={textareaClass}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {TEXT_FIELDS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-1">
          <label htmlFor={`offer-${key}`} className="text-sm font-medium text-gray-900">
            {label}
          </label>
          <textarea
            id={`offer-${key}`}
            value={form[key] as string}
            onChange={(event) => setField(key, event.target.value as EditableOffer[typeof key])}
            disabled={submitting}
            rows={key === "description" ? 3 : 2}
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
