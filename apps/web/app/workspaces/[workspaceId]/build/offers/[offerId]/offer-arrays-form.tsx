"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import type { OfferComponent, OfferBonus, OfferObjection } from "@onevyrt/contracts";
import { patchJson } from "@/lib/browser-api";

interface UpdateOfferBody {
  error?: string;
}

export interface EditableOfferArrays {
  offerComponents: OfferComponent[];
  bonuses: OfferBonus[];
  objections: OfferObjection[];
}

const fieldClass =
  "w-full rounded-md border border-gray-500 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/** Immutable "update the item at index" - keeps noUncheckedIndexedAccess happy (no index writes). */
function updateAt<T>(arr: T[], index: number, patch: Partial<T>): T[] {
  return arr.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function removeAt<T>(arr: T[], index: number): T[] {
  return arr.filter((_, i) => i !== index);
}

/**
 * Phase 9 Build depth slice: the editable counterpart to the offer detail
 * page's previously read-only components / bonuses / objections lists.
 * These three are whole-list-replacement fields on updateOffer (not
 * deep-merged), so this form always sends the complete arrays, and drops
 * rows whose required field (a component/bonus name, an objection) is blank
 * so a half-typed row can't 400 the whole save.
 */
export function OfferArraysForm({
  workspaceId,
  offerId,
  initial,
}: {
  workspaceId: string;
  offerId: string;
  initial: EditableOfferArrays;
}) {
  const router = useRouter();
  const [components, setComponents] = useState<OfferComponent[]>(initial.offerComponents);
  const [bonuses, setBonuses] = useState<OfferBonus[]>(initial.bonuses);
  const [objections, setObjections] = useState<OfferObjection[]>(initial.objections);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  function touch() {
    setSaved(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Trim every field, then drop rows the contract would reject (a blank
    // required field) so an empty "add" row is silently ignored rather than
    // failing the save.
    const cleanComponents = components
      .map((component) => ({
        name: component.name.trim(),
        description: component.description.trim(),
      }))
      .filter((component) => component.name.length > 0);
    const cleanBonuses = bonuses
      .map((bonus) => ({
        name: bonus.name.trim(),
        description: bonus.description.trim(),
        value: bonus.value.trim(),
      }))
      .filter((bonus) => bonus.name.length > 0);
    const cleanObjections = objections
      .map((objection) => ({
        objection: objection.objection.trim(),
        response: objection.response.trim(),
      }))
      .filter((objection) => objection.objection.length > 0);

    setSubmitting(true);
    setError(undefined);
    try {
      const outcome = await patchJson<UpdateOfferBody>(
        `/api/workspaces/${workspaceId}/offers/${offerId}`,
        {
          offerComponents: cleanComponents,
          bonuses: cleanBonuses,
          objections: cleanObjections,
        },
      );
      if (!outcome.ok) {
        setError(outcome.data.error ?? "Could not save. Please try again.");
        return;
      }
      // Reflect exactly what was persisted (blank rows dropped).
      setComponents(cleanComponents);
      setBonuses(cleanBonuses);
      setObjections(cleanObjections);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-gray-900">Components</p>
        <p className="text-xs text-gray-500">
          The concrete pieces that make up the offer - what the buyer actually gets.
        </p>
        {components.map((component, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-md border border-gray-300 p-3">
            <input
              aria-label={`Component ${index + 1} name`}
              value={component.name}
              onChange={(event) => {
                setComponents((current) => updateAt(current, index, { name: event.target.value }));
                touch();
              }}
              disabled={submitting}
              placeholder="Component name"
              maxLength={200}
              className={fieldClass}
            />
            <textarea
              aria-label={`Component ${index + 1} description`}
              value={component.description}
              onChange={(event) => {
                setComponents((current) =>
                  updateAt(current, index, { description: event.target.value }),
                );
                touch();
              }}
              disabled={submitting}
              placeholder="What this component is (optional)"
              rows={2}
              className={fieldClass}
            />
            <div>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setComponents((current) => removeAt(current, index));
                  touch();
                }}
                disabled={submitting}
              >
                Remove component
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setComponents((current) => [...current, { name: "", description: "" }]);
              touch();
            }}
            disabled={submitting}
          >
            Add component
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-gray-900">Bonuses</p>
        <p className="text-xs text-gray-500">
          Extras that increase perceived value. The value is a marketing claim (free text), not a
          ledger amount.
        </p>
        {bonuses.map((bonus, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-md border border-gray-300 p-3">
            <input
              aria-label={`Bonus ${index + 1} name`}
              value={bonus.name}
              onChange={(event) => {
                setBonuses((current) => updateAt(current, index, { name: event.target.value }));
                touch();
              }}
              disabled={submitting}
              placeholder="Bonus name"
              maxLength={200}
              className={fieldClass}
            />
            <input
              aria-label={`Bonus ${index + 1} value`}
              value={bonus.value}
              onChange={(event) => {
                setBonuses((current) => updateAt(current, index, { value: event.target.value }));
                touch();
              }}
              disabled={submitting}
              placeholder="Stated value (e.g. $500) (optional)"
              maxLength={100}
              className={fieldClass}
            />
            <textarea
              aria-label={`Bonus ${index + 1} description`}
              value={bonus.description}
              onChange={(event) => {
                setBonuses((current) =>
                  updateAt(current, index, { description: event.target.value }),
                );
                touch();
              }}
              disabled={submitting}
              placeholder="What this bonus is (optional)"
              rows={2}
              className={fieldClass}
            />
            <div>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setBonuses((current) => removeAt(current, index));
                  touch();
                }}
                disabled={submitting}
              >
                Remove bonus
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setBonuses((current) => [...current, { name: "", description: "", value: "" }]);
              touch();
            }}
            disabled={submitting}
          >
            Add bonus
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-gray-900">Objections</p>
        <p className="text-xs text-gray-500">
          The reasons a buyer hesitates, paired with how you answer each one.
        </p>
        {objections.map((objection, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-md border border-gray-300 p-3">
            <input
              aria-label={`Objection ${index + 1}`}
              value={objection.objection}
              onChange={(event) => {
                setObjections((current) =>
                  updateAt(current, index, { objection: event.target.value }),
                );
                touch();
              }}
              disabled={submitting}
              placeholder="Objection"
              maxLength={500}
              className={fieldClass}
            />
            <textarea
              aria-label={`Objection ${index + 1} response`}
              value={objection.response}
              onChange={(event) => {
                setObjections((current) =>
                  updateAt(current, index, { response: event.target.value }),
                );
                touch();
              }}
              disabled={submitting}
              placeholder="Your response (optional)"
              rows={2}
              className={fieldClass}
            />
            <div>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setObjections((current) => removeAt(current, index));
                  touch();
                }}
                disabled={submitting}
              >
                Remove objection
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setObjections((current) => [...current, { objection: "", response: "" }]);
              touch();
            }}
            disabled={submitting}
          >
            Add objection
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save components, bonuses & objections"}
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
