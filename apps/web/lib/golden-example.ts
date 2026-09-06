/**
 * Business OS — Golden Example store. The last AI-generated worked example of
 * the loss-leader / value-ladder strategy, applied to this business. Stored
 * under the `goldenExample` section of the shared workspace_business blob
 * (lib/business.ts) — no new migration, same pattern as lib/economics.ts.
 *
 * The shape + sanitisation live in the pure lib/studio/golden-example.ts so
 * they're testable without the db; this file is just the persistence. Kept so
 * the example survives a reload and can later feed other generators as shared
 * strategy context.
 */
import { getBusiness, saveBusinessSection } from "./business";
import { sanitizeGoldenExample, type GoldenExample } from "./studio/golden-example";

export type { GoldenExample } from "./studio/golden-example";

export async function getGoldenExample(workspaceId: string): Promise<GoldenExample | null> {
  const biz = await getBusiness(workspaceId);
  const raw = biz.goldenExample;
  if (!raw) return null;
  const clean = sanitizeGoldenExample(raw);
  if (!clean) return null;
  const updatedAt = (raw as { updatedAt?: string }).updatedAt;
  return updatedAt ? { ...clean, updatedAt } : clean;
}

export async function saveGoldenExample(workspaceId: string, data: unknown): Promise<GoldenExample> {
  const clean = sanitizeGoldenExample(data);
  if (!clean) throw new Error("a golden example needs at least one ladder rung");
  clean.updatedAt = new Date().toISOString();
  await saveBusinessSection(workspaceId, "goldenExample", clean);
  return clean;
}
