/**
 * Business-OS store: one jsonb blob per workspace holding the strategic
 * operating systems, keyed by system name (realityMap, driverTree,
 * constraint, growthDrivers, …). saveBusinessSection shallow-merges a single
 * section so saving the Reality Map never touches the Driver Tree, etc.
 * See migrations/1786630600000_workspace-business.js.
 */
import { pgPool } from "./db";

/** Where the business is today. Some of these can later be auto-derived from
 *  Money Machine / ACTUAL; captured directly for now. */
export interface RealityNow {
  revenue?: string; profit?: string; customers?: string; team?: string; stage?: string;
}
export interface RealityGap {
  revenue?: string; capability?: string; acquisition?: string; product?: string; team?: string; system?: string;
}
export interface BusinessRealityMap {
  businessIn?: string;         // what business are we in? (surface category)
  businessReallyIn?: string;   // what business are we REALLY in? (deeper outcome)
  businessNeedToBeIn?: string; // what business do we NEED to be in? (future)
  now?: RealityNow;
  want12m?: string;
  want36m?: string;
  targetRevenue?: string;
  gaps?: RealityGap;
}

export interface BusinessData {
  realityMap?: BusinessRealityMap;
  // future systems: driverTree, constraint, growthDrivers, lifecycle, …
  [section: string]: unknown;
}

// Per-section ceiling. Each section is its own key in the jsonb blob and is
// bounded independently, so one section can never starve another (Postgres
// jsonb comfortably holds megabytes). The sanitisers cap list sizes so a
// realistic maxed-out section stays well under this.
const MAX_SECTION = 1_000_000;

export async function getBusiness(workspaceId: string): Promise<BusinessData> {
  const res = await pgPool().query<{ data: BusinessData }>("SELECT data FROM workspace_business WHERE workspace_id = $1", [workspaceId]);
  return res.rows[0]?.data ?? {};
}

/** Merges one section into the workspace's business blob, leaving every other
 *  section untouched. The merge happens server-side via the jsonb `||` operator
 *  (which replaces only the given top-level key), so two concurrent writes to
 *  DIFFERENT sections of the same workspace can no longer clobber each other —
 *  no read-modify-write race. Returns the full merged document. */
export async function saveBusinessSection<K extends keyof BusinessData>(workspaceId: string, section: K, value: BusinessData[K]): Promise<BusinessData> {
  const sectionJson = JSON.stringify(value ?? null);
  if (sectionJson.length > MAX_SECTION) throw new Error("This section is too large to save.");
  const now = new Date().toISOString();
  const patch = JSON.stringify({ [section as string]: value });
  const res = await pgPool().query<{ data: BusinessData }>(
    `INSERT INTO workspace_business (workspace_id, data, created_at, updated_at)
     VALUES ($1, $2::jsonb, $3, $3)
     ON CONFLICT (workspace_id) DO UPDATE SET
       data = COALESCE(workspace_business.data, '{}'::jsonb) || $2::jsonb,
       updated_at = $3
     RETURNING data`,
    [workspaceId, patch, now],
  );
  return res.rows[0]?.data ?? ({ [section]: value } as BusinessData);
}
