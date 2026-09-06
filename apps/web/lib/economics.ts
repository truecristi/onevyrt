/**
 * Business OS — Economics store. The Numbers-side counterpart to the offer:
 * fixed costs, the variable cost per sale, and optional current volume / profit
 * goal. Stored under the `economics` section of the shared workspace_business
 * blob (lib/business.ts) — no new migration, same pattern as lib/offer.ts.
 *
 * The shape, sanitisation and viability read live in the pure
 * lib/studio/economics.ts so they're testable without the db; this file is just
 * the persistence.
 */
import { getBusiness, saveBusinessSection } from "./business";
import { sanitizeEconomics, EMPTY_ECONOMICS, type EconomicsData } from "./studio/economics";

export type { EconomicsData } from "./studio/economics";

export async function getEconomics(workspaceId: string): Promise<EconomicsData> {
  const biz = await getBusiness(workspaceId);
  const raw = biz.economics as EconomicsData | undefined;
  return raw ? { ...sanitizeEconomics(raw), updatedAt: raw.updatedAt } : { ...EMPTY_ECONOMICS };
}

export async function saveEconomics(workspaceId: string, data: unknown): Promise<EconomicsData> {
  const clean = sanitizeEconomics(data);
  clean.updatedAt = new Date().toISOString();
  await saveBusinessSection(workspaceId, "economics", clean);
  return clean;
}
