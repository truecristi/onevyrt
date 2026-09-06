/**
 * Business OS — Growth Constraint Engine. At any moment one area limits growth
 * more than the rest; the whole point is to find it and focus there instead of
 * spreading effort thin. The user scores candidate areas by how much each is
 * holding growth back; the engine surfaces the top-scored area as the likely
 * constraint, and the user declares the constraint plus the single move to
 * relieve it and what to stop doing elsewhere. Stored under the `constraint`
 * section of the shared workspace_business blob (lib/business.ts) — no new
 * migration.
 *
 * Original, general bottleneck-focus mechanics (score areas, focus the biggest,
 * relieve then subordinate); no external course material or thresholds embedded.
 */
import { randomUUID } from "node:crypto";
import { getBusiness, saveBusinessSection } from "./business";

export interface ConstraintArea {
  id: string;
  area: string;
  severity: number; // 0..5 — how much this holds growth back right now
  evidence: string;
}
export interface ConstraintData {
  areas: ConstraintArea[];
  chosen: string;    // the declared current constraint
  why: string;       // why it's the constraint (the evidence)
  relieve: string;   // the single move to relieve it
  stopDoing: string; // what to stop/subordinate so the constraint gets the focus
  updatedAt?: string;
}

/** The starter areas across the growth system. The user can rename/add/remove. */
export const DEFAULT_AREAS = [
  "Traffic & attention", "Lead capture & conversion", "Sales & closing", "Offer & pricing",
  "Delivery & fulfilment", "Retention & repeat", "Margin & profit", "Cash & finance",
  "Team & capacity", "Systems & operations",
];

const EMPTY: ConstraintData = { areas: [], chosen: "", why: "", relieve: "", stopDoing: "" };

export async function getConstraint(workspaceId: string): Promise<ConstraintData> {
  const biz = await getBusiness(workspaceId);
  const c = (biz.constraint as ConstraintData | undefined) ?? EMPTY;
  return { areas: c.areas ?? [], chosen: c.chosen ?? "", why: c.why ?? "", relieve: c.relieve ?? "", stopDoing: c.stopDoing ?? "", updatedAt: c.updatedAt };
}

export async function saveConstraint(workspaceId: string, data: ConstraintData): Promise<ConstraintData> {
  const clean = sanitizeConstraint(data);
  clean.updatedAt = new Date().toISOString();
  await saveBusinessSection(workspaceId, "constraint", clean);
  return clean;
}

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v.slice(0, n) : "");

export function sanitizeConstraint(v: unknown): ConstraintData {
  const c = (v ?? {}) as Record<string, unknown>;
  const areas = Array.isArray(c.areas)
    ? c.areas.slice(0, 30).map((raw): ConstraintArea => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const sev = Number(r.severity);
        return {
          id: typeof r.id === "string" && r.id ? r.id.slice(0, 64) : randomUUID(),
          area: clip(r.area, 120), severity: Number.isFinite(sev) ? Math.max(0, Math.min(5, Math.round(sev))) : 0, evidence: clip(r.evidence, 600),
        };
      })
    : [];
  return { areas, chosen: clip(c.chosen, 200), why: clip(c.why, 1000), relieve: clip(c.relieve, 1000), stopDoing: clip(c.stopDoing, 1000) };
}
