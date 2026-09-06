/**
 * Compact "business strategy brief" the AI generators can condition on — the
 * Business-OS counterpart to lib/campaign/brand-brief.ts. Where the brand brief
 * carries voice and facts, this carries STRATEGY: what business the workspace is
 * really in, where it's heading, its single current growth constraint, and the
 * levers that move the outcome. Feeding this in stops AI copy/creative/funnel
 * advice from being generically on-brand but strategically blind.
 *
 * Server-only: the Business-OS section libs (constraint, drivers) import
 * node:crypto, so the shape is read here from the raw jsonb blob rather than by
 * importing those modules. Pure and defensive — every field is optional, so a
 * workspace that has filled in nothing yields { has: false } and callers skip
 * the block, exactly like hasBrand/brandBrief.
 */
import type { BusinessData, BusinessRealityMap } from "./business";

// Minimal read-only views of the two section shapes we summarise. Kept local so
// this stays a leaf module with no pull on the node-only section libs.
interface ConstraintView { chosen?: string; why?: string; relieve?: string; stopDoing?: string }
interface DriverView { label?: string; current?: string; target?: string }
interface DriverTreeView { outcomeLabel?: string; outcomeTarget?: string; drivers?: DriverView[] }

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const clip = (v: string, n = 240): string => (v.length > n ? v.slice(0, n - 1) + "…" : v);

/** Build the strategy brief from a workspace's Business-OS blob. */
export function strategyBriefFrom(biz: BusinessData | null | undefined): { text: string; has: boolean } {
  if (!biz) return { text: "", has: false };
  const lines: string[] = [];

  const rm = (biz.realityMap ?? {}) as BusinessRealityMap;
  if (s(rm.businessReallyIn)) lines.push(`Really in the business of: ${clip(s(rm.businessReallyIn))}`);
  if (s(rm.businessNeedToBeIn)) lines.push(`Needs to become: ${clip(s(rm.businessNeedToBeIn))}`);
  if (s(rm.want12m)) lines.push(`12-month goal: ${clip(s(rm.want12m))}`);
  if (s(rm.want36m)) lines.push(`3-year vision: ${clip(s(rm.want36m))}`);
  if (s(rm.targetRevenue)) lines.push(`Target revenue: ${clip(s(rm.targetRevenue), 80)}`);
  const gaps = (rm.gaps ?? {}) as Record<string, unknown>;
  const gapParts = Object.entries(gaps)
    .map(([k, v]) => (s(v) ? `${k} — ${clip(s(v), 120)}` : ""))
    .filter(Boolean)
    .slice(0, 3);
  if (gapParts.length) lines.push(`Biggest gaps: ${gapParts.join("; ")}`);

  const c = (biz.constraint ?? {}) as ConstraintView;
  if (s(c.chosen)) lines.push(`Current #1 growth constraint: ${clip(s(c.chosen))}${s(c.why) ? ` (because ${clip(s(c.why), 160)})` : ""}`);
  if (s(c.relieve)) lines.push(`The move to relieve it: ${clip(s(c.relieve))}`);
  if (s(c.stopDoing)) lines.push(`Deprioritised for now: ${clip(s(c.stopDoing), 120)}`);

  const dt = (biz.driverTree ?? {}) as DriverTreeView;
  if (s(dt.outcomeLabel) && s(dt.outcomeTarget)) lines.push(`Outcome the plan drives: ${clip(s(dt.outcomeLabel), 80)} → ${clip(s(dt.outcomeTarget), 80)}`);
  const levers = (dt.drivers ?? [])
    .map((d) => (s(d.label) && s(d.target) ? `${clip(s(d.label), 60)} (${s(d.current) || "?"}→${clip(s(d.target), 40)})` : ""))
    .filter(Boolean)
    .slice(0, 4);
  if (levers.length) lines.push(`Key growth levers: ${levers.join(", ")}`);

  return { text: lines.join("\n"), has: lines.length > 0 };
}
