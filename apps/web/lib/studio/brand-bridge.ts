/**
 * Brand bridge — extends reality-bridge.ts's pattern to Brand Brain. Studio's
 * ProgramCentre keeps its business definition inside the per-project
 * FunnelDoc; Brand Brain keeps a workspace-scoped brand profile at
 * /api/campaign-studio/brand. They overlap on the business's name.
 *
 * Fetches Brand Brain (SCOPE-CORRECT: pass the SAME activeWsId Studio is
 * working in, so a suggestion can never surface another business's facts)
 * and maps only the genuine 1:1 overlap into a partial BusinessDefinition.
 * Nothing here writes anything — the UI offers the mapped value as a
 * "use this" suggestion the founder accepts per field, same as
 * reality-bridge.ts. No lossy guesses, no auto-overwrite.
 */
import type { BusinessDefinition } from "@onevyrt/engine";

export interface BrandBridgeProfile {
  companyName?: string;
}

/** Fetch the workspace's Brand Brain profile. Returns null when there's
 *  nothing to mirror (no workspace, Campaign Studio not entitled, not
 *  saved, request failed) — callers treat null as "no suggestions", never
 *  as an error. */
export async function fetchBrandProfile(wsId: string): Promise<BrandBridgeProfile | null> {
  if (!wsId) return null;
  try {
    const r = await fetch(`/api/campaign-studio/brand?ws=${encodeURIComponent(wsId)}`, { credentials: "include" });
    if (!r.ok) return null; // e.g. 403 when Campaign Studio isn't entitled — no suggestions, not an error
    const profile = (await r.json()) as unknown;
    return profile && typeof profile === "object" ? (profile as BrandBridgeProfile) : null;
  } catch {
    return null;
  }
}

const s = (v?: string): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** The subset of BusinessDefinition fields Brand Brain can legitimately
 *  fill, and only the genuine overlap. Empty values are dropped, so an
 *  empty/missing profile yields {} (no suggestions shown). */
export function brandToDefinition(profile: BrandBridgeProfile | null): Partial<BusinessDefinition> {
  if (!profile) return {};
  const out: Partial<BusinessDefinition> = { businessName: s(profile.companyName) };
  for (const k of Object.keys(out) as (keyof BusinessDefinition)[]) if (!out[k]) delete out[k];
  return out;
}

/** Human label for where a suggested value came from — shown on the
 *  "use this" chip so the founder knows Studio is echoing Brand Brain,
 *  not inventing text. */
export const BRAND_FIELD_SOURCE: Partial<Record<keyof BusinessDefinition, string>> = {
  businessName: "your Brand Brain",
};
