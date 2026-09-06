"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@onevyrt/design-system";
import { putJson } from "@/lib/browser-api";

type Stage = "idea" | "launched" | "growing" | "established";

interface SaveBody {
  businessProfile?: { id: string };
  error?: string;
}

interface BusinessProfileInitial {
  name: string;
  vision: string;
  mission: string;
  industry: string;
  stage: Stage;
}

const textareaClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";
const selectClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";

/**
 * Phase 9 Today depth slice (business profile): the workspace's identity -
 * name, vision, mission, industry and stage. This is the same
 * business_profile the AI coaching context is assembled from, so keeping it
 * current sharpens every AI feature. Built on the existing Phase 2
 * business-core profile domain and API layer (upsert via PUT) - no domain
 * or API changes.
 */
export function BusinessProfileForm({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: BusinessProfileInitial;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [industry, setIndustry] = useState(initial.industry);
  const [stage, setStage] = useState<Stage>(initial.stage);
  const [vision, setVision] = useState(initial.vision);
  const [mission, setMission] = useState(initial.mission);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return;

    setSubmitting(true);
    setError(undefined);
    setSaved(false);
    try {
      const outcome = await putJson<SaveBody>(`/api/workspaces/${workspaceId}/business-profile`, {
        name: name.trim(),
        vision: vision.trim(),
        mission: mission.trim(),
        industry: industry.trim(),
        stage,
      });
      if (!outcome.ok || !outcome.data.businessProfile) {
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
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-gray-500 p-4"
    >
      <Input
        label="Business name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setSaved(false);
        }}
        disabled={submitting}
        maxLength={200}
        placeholder="e.g. Acme Analytics"
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            label="Industry (optional)"
            value={industry}
            onChange={(event) => {
              setIndustry(event.target.value);
              setSaved(false);
            }}
            disabled={submitting}
            maxLength={200}
            placeholder="e.g. B2B SaaS"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-stage" className="text-sm font-medium text-gray-900">
            Stage
          </label>
          <select
            id="profile-stage"
            value={stage}
            onChange={(event) => {
              setStage(event.target.value as Stage);
              setSaved(false);
            }}
            disabled={submitting}
            className={selectClass}
          >
            <option value="idea">Idea</option>
            <option value="launched">Launched</option>
            <option value="growing">Growing</option>
            <option value="established">Established</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="profile-vision" className="text-sm font-medium text-gray-900">
          Vision (optional)
        </label>
        <textarea
          id="profile-vision"
          value={vision}
          onChange={(event) => {
            setVision(event.target.value);
            setSaved(false);
          }}
          disabled={submitting}
          rows={2}
          maxLength={2000}
          placeholder="Where this business is headed"
          className={textareaClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="profile-mission" className="text-sm font-medium text-gray-900">
          Mission (optional)
        </label>
        <textarea
          id="profile-mission"
          value={mission}
          onChange={(event) => {
            setMission(event.target.value);
            setSaved(false);
          }}
          disabled={submitting}
          rows={2}
          maxLength={2000}
          placeholder="What this business does, for whom"
          className={textareaClass}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Saving..." : "Save profile"}
        </Button>
        {saved && <span className="text-sm text-green-700">Saved.</span>}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
