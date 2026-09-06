/**
 * Reality bridge — kills the Studio ↔ Business-OS "data split-brain" at the
 * human layer. Studio's ProgramCentre keeps its business definition inside the
 * per-project FunnelDoc, while Business-OS keeps a workspace-scoped reality map
 * at /api/business/reality. They overlap: a founder who filled the reality map
 * shouldn't have to retype the same facts into Studio.
 *
 * This module fetches that reality map (SCOPE-CORRECT: pass the SAME activeWsId
 * Studio is working in, so a suggestion can never surface another business's
 * facts) and maps only the genuine 1:1 overlaps into a partial BusinessDefinition.
 * Nothing here writes anything — the UI offers each mapped value as a "use this"
 * suggestion the founder accepts per field. No lossy guesses, no auto-overwrite.
 */
import type { BusinessDefinition } from "@onevyrt/engine";
import type { BusinessRealityMap as RealityMap } from "../reality";

export type { RealityNow, RealityGap } from "../reality";

/** Fetch the workspace's Business-OS reality map. Returns null when there's
 *  nothing to mirror (no workspace, not saved, request failed) — callers treat
 *  null as "no suggestions", never as an error. The GET returns the map object
 *  directly (see app/api/business/reality/route.ts). */
export async function fetchRealityMap(wsId: string): Promise<RealityMap | null> {
  if (!wsId) return null;
  try {
    const r = await fetch(`/api/business/reality?ws=${encodeURIComponent(wsId)}`, { credentials: "include" });
    if (!r.ok) return null;
    const map = (await r.json()) as unknown;
    return map && typeof map === "object" ? (map as RealityMap) : null;
  } catch {
    return null;
  }
}

const s = (v?: string): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** The subset of BusinessDefinition fields the reality map can legitimately fill,
 *  and only the genuine overlaps. `currentReality` falls back to a composed
 *  snapshot of the "now" numbers when the free-text field is blank. Empty values
 *  are dropped, so an empty map yields {} (no suggestions shown). */
export function realityToDefinition(map: RealityMap | null): Partial<BusinessDefinition> {
  if (!map) return {};
  const now = map.now ?? {};
  const composedNow = [
    now.stage && `Stage: ${now.stage}`,
    now.revenue && `Revenue: ${now.revenue}`,
    now.customers && `Customers: ${now.customers}`,
    now.team && `Team: ${now.team}`,
  ].filter(Boolean).join(" · ");
  const out: Partial<BusinessDefinition> = {
    currentReality: s(map.businessReallyIn) ?? s(composedNow),
    breakthrough: s(map.businessNeedToBeIn),
    milestones: s(map.want12m),
    vision: s(map.want36m),
  };
  for (const k of Object.keys(out) as (keyof BusinessDefinition)[]) if (!out[k]) delete out[k];
  return out;
}

/** Human label for where a suggested value came from — shown on the "use this"
 *  chip so the founder knows Studio is echoing Business-OS, not inventing text. */
export const REALITY_FIELD_SOURCE: Partial<Record<keyof BusinessDefinition, string>> = {
  currentReality: "where the business really is",
  breakthrough: "where it needs to be",
  milestones: "your 12-month want",
  vision: "your 36-month want",
};
