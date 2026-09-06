/**
 * Business OS — Presentation checklist store. Which presentation & trust items
 * the owner has checked off, persisted under the `presentation` section of the
 * shared workspace_business blob (lib/business.ts) — no new migration, same
 * pattern as lib/offer.ts and lib/economics.ts. Persisting server-side (instead
 * of the old per-browser localStorage) makes the presentation part of the
 * persuasion score consistent across devices.
 *
 * The item set, scoring and id sanitisation live in the pure
 * lib/studio/presentation.ts so they're testable without the db.
 */
import { getBusiness, saveBusinessSection } from "./business";
import { sanitizeCheckedIds } from "./studio/presentation";

export interface PresentationState { checked: string[]; updatedAt?: string; }

export async function getPresentation(workspaceId: string): Promise<PresentationState> {
  const biz = await getBusiness(workspaceId);
  const raw = biz.presentation as { checked?: unknown; updatedAt?: string } | undefined;
  return { checked: sanitizeCheckedIds(raw?.checked), updatedAt: raw?.updatedAt };
}

export async function savePresentation(workspaceId: string, data: unknown): Promise<PresentationState> {
  const checked = sanitizeCheckedIds((data as { checked?: unknown } | null | undefined)?.checked ?? data);
  const value: PresentationState = { checked, updatedAt: new Date().toISOString() };
  await saveBusinessSection(workspaceId, "presentation", value);
  return value;
}
