"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";
import { dollarsToCents } from "./format";

interface CreateOfferBody {
  offer?: { id: string };
  error?: string;
}

/**
 * Phase 9 Build slice: a deliberately minimal "quick create" - just a
 * name and an optional price - so the list page has a low-friction way to
 * add an offer. Everything else (positioning, guarantee, the full copy
 * fields) is filled in on the offer's own detail page afterward, the same
 * "create small, flesh out on detail" shape the rest of this codebase
 * favours over one giant form.
 */
export function CreateOfferForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return;

    const priceCents = dollarsToCents(price);
    if (Number.isNaN(priceCents)) {
      setError("Price must be a number, e.g. 49 or 49.99.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateOfferBody>(`/api/workspaces/${workspaceId}/offers`, {
        name: name.trim(),
        ...(priceCents !== null ? { priceCents } : {}),
      });
      if (!outcome.ok || !outcome.data.offer) {
        setError(outcome.data.error ?? "Could not create the offer. Please try again.");
        return;
      }
      setName("");
      setPrice("");
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
      <p className="text-sm font-semibold text-gray-900">New offer</p>
      <Input
        label="Offer name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={submitting}
        required
        placeholder="e.g. 12-week coaching program"
      />
      <Input
        label="Price (optional)"
        type="number"
        min="0"
        step="0.01"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        disabled={submitting}
        hint="In dollars. Leave blank if you haven't set one yet."
      />
      <div>
        <Button type="submit" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Creating..." : "Create offer"}
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
