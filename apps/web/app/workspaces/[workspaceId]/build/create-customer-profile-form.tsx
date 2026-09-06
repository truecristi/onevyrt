"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface CreateCustomerProfileBody {
  customerProfile?: { id: string };
  error?: string;
}

/**
 * Phase 9 Build slice (customer profiles): a minimal quick-create - name
 * plus an optional one-line description - so the Build page has a
 * low-friction way to add a profile. The full definition (pain points,
 * desired outcome, unique mechanism, positioning, etc.) is filled in on
 * the profile's own detail page afterward, the same "create small, flesh
 * out on detail" shape the offer create form uses.
 */
export function CreateCustomerProfileForm({ workspaceId }: { workspaceId: string }) {
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
      const outcome = await postJson<CreateCustomerProfileBody>(
        `/api/workspaces/${workspaceId}/customer-profiles`,
        { name: name.trim(), description: description.trim() },
      );
      if (!outcome.ok || !outcome.data.customerProfile) {
        setError(outcome.data.error ?? "Could not create the profile. Please try again.");
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
      <p className="text-sm font-semibold text-gray-900">New customer profile</p>
      <Input
        label="Profile name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={submitting}
        required
        placeholder="e.g. Early-stage SaaS founders"
      />
      <Input
        label="Description (optional)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        disabled={submitting}
        hint="A one-line summary. You can flesh out the full profile after creating it."
      />
      <div>
        <Button type="submit" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Creating..." : "Create profile"}
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
