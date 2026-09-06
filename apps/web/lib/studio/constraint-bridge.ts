/**
 * Constraint bridge — extends reality-bridge.ts's pattern to the Growth
 * Constraint tool. Studio's ProgramCentre keeps its business definition
 * inside the per-project FunnelDoc; the Growth Constraint tool keeps a
 * workspace-scoped declared bottleneck at /api/business/constraint. They
 * overlap on "what's limiting growth right now."
 *
 * Fetches the Growth Constraint tool (SCOPE-CORRECT: pass the SAME
 * activeWsId Studio is working in) and maps only the genuine 1:1 overlap
 * into a partial BusinessDefinition. Nothing here writes anything — the UI
 * offers the mapped value as a "use this" suggestion the founder accepts
 * per field, same as reality-bridge.ts. No lossy guesses, no auto-overwrite.
 */
import type { BusinessDefinition } from "@onevyrt/engine";

export interface ConstraintBridgeData {
  chosen?: string;
}

/** Fetch the workspace's Growth Constraint data. Returns null when
 *  there's nothing to mirror (no workspace, not saved, request failed) —
 *  callers treat null as "no suggestions", never as an error. */
export async function fetchConstraint(wsId: string): Promise<ConstraintBridgeData | null> {
  if (!wsId) return null;
  try {
    const r = await fetch(`/api/business/constraint?ws=${encodeURIComponent(wsId)}`, { credentials: "include" });
    if (!r.ok) return null;
    const data = (await r.json()) as unknown;
    return data && typeof data === "object" ? (data as ConstraintBridgeData) : null;
  } catch {
    return null;
  }
}

const s = (v?: string): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** The one genuine overlap: the declared current constraint (`chosen`)
 *  maps straight onto `mainConstraint` — matching assembleMyBusiness's
 *  own existing precedence for this exact field. Empty values are
 *  dropped, so an empty/missing constraint yields {}. */
export function constraintToDefinition(constraint: ConstraintBridgeData | null): Partial<BusinessDefinition> {
  if (!constraint) return {};
  const out: Partial<BusinessDefinition> = { mainConstraint: s(constraint.chosen) };
  for (const k of Object.keys(out) as (keyof BusinessDefinition)[]) if (!out[k]) delete out[k];
  return out;
}

/** Human label for where a suggested value came from — shown on the
 *  "use this" chip so the founder knows Studio is echoing the Growth
 *  Constraint tool, not inventing text. */
export const CONSTRAINT_FIELD_SOURCE: Partial<Record<keyof BusinessDefinition, string>> = {
  mainConstraint: "your Growth Constraint tool",
};
