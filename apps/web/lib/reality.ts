/**
 * Business OS — Reality Map store. "Where the business is today" — what
 * business you're really in, current numbers, 12/36-month horizons, and
 * the gaps between now and where you need to be. Stored under the
 * `realityMap` section of the shared workspace_business blob
 * (lib/business.ts) — no new migration, same pattern as
 * lib/constraint.ts/lib/offer.ts/lib/message.ts.
 *
 * Extracted from its former home inlined in
 * app/api/business/reality/route.ts, matching the other three
 * Business-OS sections' get/sanitize/save(/patch) module shape. Also
 * fixes a real bug found in that inlined code: the old PATCH handler
 * always rebuilt the whole realityMap from whatever top-level keys were
 * present in ITS OWN request body, silently WIPING any field a caller
 * omitted — the reality editor page never hit this (it always PATCHes
 * its complete local state), but app/business/review/page.tsx's
 * pushToReality() had to work around it with its own unlocked
 * client-side GET-then-spread-then-write. patchReality() below is a
 * true read-modify-write partial merge instead, so a narrow caller like
 * pushToReality can PATCH just the fields it means to change.
 */
import { getBusiness, saveBusinessSection, type BusinessRealityMap, type RealityNow, type RealityGap } from "./business";
import { withAdvisoryLock } from "./db";

export type { BusinessRealityMap, RealityNow, RealityGap } from "./business";

const EMPTY: BusinessRealityMap = {};

export async function getReality(workspaceId: string): Promise<BusinessRealityMap> {
  const biz = await getBusiness(workspaceId);
  return biz.realityMap ?? EMPTY;
}

const clip = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, 4000) : undefined);
function pickStrings(v: unknown, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === "object") for (const k of keys) { const s = clip((v as Record<string, unknown>)[k]); if (s !== undefined) out[k] = s; }
  return out;
}

/** Defensive normalisation on the way into storage — the same "never
 *  trust what the route already checked" belt-and-braces the other three
 *  Business-OS sections apply. Rebuilds a full BusinessRealityMap from
 *  whatever's present in `v`; callers that only mean to touch SOME fields
 *  should go through patchReality() instead, never call this directly
 *  with a partial object. */
export function sanitizeReality(v: unknown): BusinessRealityMap {
  const r = (v ?? {}) as Record<string, unknown>;
  return {
    businessIn: clip(r.businessIn), businessReallyIn: clip(r.businessReallyIn), businessNeedToBeIn: clip(r.businessNeedToBeIn),
    now: pickStrings(r.now, ["revenue", "profit", "customers", "team", "stage"]) as RealityNow,
    want12m: clip(r.want12m), want36m: clip(r.want36m), targetRevenue: clip(r.targetRevenue),
    gaps: pickStrings(r.gaps, ["revenue", "capability", "acquisition", "product", "team", "system"]) as RealityGap,
  };
}

// Same lock family as lib/offer.ts/lib/message.ts — see offer.ts's
// offerLockKey comment for why this is keyed per workspace+section and
// why writeRealityRaw below must stay unlocked (no re-entrant locking).
const realityLockKey = (workspaceId: string) => `workspace-business:realityMap:${workspaceId}`;

async function writeRealityRaw(workspaceId: string, data: unknown): Promise<BusinessRealityMap> {
  const clean = sanitizeReality(data);
  await saveBusinessSection(workspaceId, "realityMap", clean);
  return clean;
}

/** Full replace — the contract the route's PATCH always effectively had
 *  (whole-object save). Kept for callers that always round-trip their
 *  complete state anyway (the reality editor page's own save flow). */
export async function saveReality(workspaceId: string, data: unknown): Promise<BusinessRealityMap> {
  return withAdvisoryLock(realityLockKey(workspaceId), () => writeRealityRaw(workspaceId, data));
}

/** True partial merge: only the top-level keys present in `patch` are
 *  touched (and, for `now`/`gaps`, only their own present sub-keys) —
 *  everything else already stored survives untouched. This is the actual
 *  bug fix this module exists for; see the module doc comment above.
 *  Runs under the SAME lock as saveReality, so a concurrent direct
 *  saveReality() (e.g. the user editing /business/reality at the same
 *  moment) can't land between this patch's read and write and get
 *  silently overwritten by a stale merge base. */
export async function patchReality(workspaceId: string, patch: Partial<BusinessRealityMap>): Promise<BusinessRealityMap> {
  return withAdvisoryLock(realityLockKey(workspaceId), async () => {
    const current = await getReality(workspaceId);
    const merged: BusinessRealityMap = { ...current, now: { ...current.now }, gaps: { ...current.gaps } };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (key === "now" || key === "gaps") {
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          if (subValue !== undefined) (merged[key as "now" | "gaps"] as Record<string, unknown>)[subKey] = subValue;
        }
        continue;
      }
      (merged as Record<string, unknown>)[key] = value;
    }
    return writeRealityRaw(workspaceId, merged);
  });
}
