"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

type ScenarioType = "base" | "best" | "worst" | "custom";

interface CreateScenarioBody {
  scenario?: { id: string };
  error?: string;
}

const selectClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

/**
 * Phase 9 Build depth slice (scenarios): a named what-if - base / best /
 * worst / custom - that overrides selected assumptions without touching the
 * baseline. Built on the existing Phase 4 scenario-modeling domain and API
 * layer. One scenario per type per workspace (the API returns 409 on a
 * duplicate), so the form surfaces that.
 */
export function CreateScenarioForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scenarioType, setScenarioType] = useState<ScenarioType>("custom");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await postJson<CreateScenarioBody>(
        `/api/workspaces/${workspaceId}/scenarios`,
        { name: name.trim(), scenarioType },
      );
      if (!outcome.ok || !outcome.data.scenario) {
        setError(
          outcome.status === 409
            ? "A scenario of this type already exists - pick another type."
            : (outcome.data.error ?? "Could not create the scenario. Please try again."),
        );
        return;
      }
      setName("");
      setScenarioType("custom");
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
      <p className="text-sm font-semibold text-gray-900">New scenario</p>
      <Input
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={submitting}
        maxLength={200}
        placeholder="e.g. Aggressive growth"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="scenario-type" className="text-sm font-medium text-gray-900">
          Type
        </label>
        <select
          id="scenario-type"
          value={scenarioType}
          onChange={(event) => setScenarioType(event.target.value as ScenarioType)}
          disabled={submitting}
          className={selectClass}
        >
          <option value="base">Base</option>
          <option value="best">Best case</option>
          <option value="worst">Worst case</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div>
        <Button type="submit" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Creating..." : "Create scenario"}
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
