/**
 * Offer bridge — extends reality-bridge.ts's pattern to the Offer tool.
 * Studio's ProgramCentre keeps its business definition inside the
 * per-project FunnelDoc; the Offer tool keeps a workspace-scoped offer at
 * /api/business/offer. They overlap on who the offer is for and what the
 * offer actually is.
 *
 * Fetches the Offer tool (SCOPE-CORRECT: pass the SAME activeWsId Studio is
 * working in) and maps only the genuine 1:1 overlaps into a partial
 * BusinessDefinition. Nothing here writes anything — the UI offers each
 * mapped value as a "use this" suggestion the founder accepts per field,
 * same as reality-bridge.ts. No lossy guesses, no auto-overwrite.
 */
import type { BusinessDefinition } from "@onevyrt/engine";

export interface OfferBridgeData {
  audience?: string;
  name?: string;
}

/** Fetch the workspace's Offer tool data. Returns null when there's
 *  nothing to mirror (no workspace, not saved, request failed) — callers
 *  treat null as "no suggestions", never as an error. */
export async function fetchOffer(wsId: string): Promise<OfferBridgeData | null> {
  if (!wsId) return null;
  try {
    const r = await fetch(`/api/business/offer?ws=${encodeURIComponent(wsId)}`, { credentials: "include" });
    if (!r.ok) return null;
    const data = (await r.json()) as unknown;
    return data && typeof data === "object" ? (data as OfferBridgeData) : null;
  } catch {
    return null;
  }
}

const s = (v?: string): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** The subset of BusinessDefinition fields the Offer tool can legitimately
 *  fill, and only the genuine overlaps: who you serve (the offer's own
 *  audience, more specific than Brand Brain's broader audience field) and
 *  the main offer (the offer's own name — matching assembleMyBusiness's
 *  own existing precedence for this exact field, not `.promise`). Empty
 *  values are dropped, so an empty/missing offer yields {}. */
export function offerToDefinition(offer: OfferBridgeData | null): Partial<BusinessDefinition> {
  if (!offer) return {};
  const out: Partial<BusinessDefinition> = { whoServe: s(offer.audience), mainOffer: s(offer.name) };
  for (const k of Object.keys(out) as (keyof BusinessDefinition)[]) if (!out[k]) delete out[k];
  return out;
}

/** Human label for where a suggested value came from — shown on the
 *  "use this" chip so the founder knows Studio is echoing the Offer
 *  tool, not inventing text. */
export const OFFER_FIELD_SOURCE: Partial<Record<keyof BusinessDefinition, string>> = {
  whoServe: "your Offer tool's audience",
  mainOffer: "your Offer tool",
};
