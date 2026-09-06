/**
 * Persistence + runtime resolution for builder-authored qualification funnels.
 * The builder writes a FunnelDoc here; the public runtime reads it back and
 * compiles it to the engine QualFunnelConfig. The demo funnel remains available
 * as a fallback (compiled from qualification-config), so /q/demo still works
 * with no persisted row.
 */
import { pgPool } from "../db";
import { track } from "../analytics";
import { PRODUCT_EVENT } from "../product-events";
import { compileFunnel, validateFunnelDoc, type FunnelDoc } from "./funnel-builder";
import { getQualFunnel, type QualFunnelConfig } from "./qualification-config";

export interface StoredFunnel {
  slug: string;
  workspaceId: string;
  doc: FunnelDoc;
  published: boolean;
  updatedAt: string;
}

function rowToStored(row: { slug: string; workspace_id: string; doc: FunnelDoc; published: boolean; updated_at: string | Date }): StoredFunnel {
  return { slug: row.slug, workspaceId: row.workspace_id, doc: row.doc, published: row.published, updatedAt: new Date(row.updated_at).toISOString() };
}

/** The raw stored funnel for a slug (any workspace), or null. */
export async function getStoredFunnel(slug: string): Promise<StoredFunnel | null> {
  const r = await pgPool().query("SELECT slug, workspace_id, doc, published, updated_at FROM qual_funnels WHERE slug = $1", [slug]);
  return r.rows[0] ? rowToStored(r.rows[0]) : null;
}

/** Every funnel a workspace owns, newest-edited first. */
export async function listWorkspaceFunnels(workspaceId: string): Promise<StoredFunnel[]> {
  const r = await pgPool().query(
    "SELECT slug, workspace_id, doc, published, updated_at FROM qual_funnels WHERE workspace_id = $1 ORDER BY updated_at DESC",
    [workspaceId],
  );
  return r.rows.map(rowToStored);
}

export class FunnelSlugTakenError extends Error {
  constructor() { super("That funnel link is already taken — pick another."); this.name = "FunnelSlugTakenError"; }
}

/**
 * Create or update a funnel for a workspace. Ownership is enforced: a slug
 * owned by another workspace can't be overwritten. Validates the doc first so
 * an unusable funnel never reaches the public runtime.
 */
export async function saveFunnel(workspaceId: string, doc: FunnelDoc, published = true): Promise<StoredFunnel> {
  const err = validateFunnelDoc(doc);
  if (err) throw new Error(err);
  const existing = await getStoredFunnel(doc.slug);
  if (existing && existing.workspaceId !== workspaceId) throw new FunnelSlugTakenError();
  await pgPool().query(
    `INSERT INTO qual_funnels (slug, workspace_id, doc, published, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (slug) DO UPDATE SET doc = EXCLUDED.doc, published = EXCLUDED.published, updated_at = now()
     WHERE qual_funnels.workspace_id = $2`,
    [doc.slug, workspaceId, JSON.stringify(doc), published],
  );
  const saved = await getStoredFunnel(doc.slug);
  if (!saved) throw new Error("save failed");
  // Product analytics (§27): the first time a slug is written it's a new
  // funnel; a published save is the "your funnel is live" milestone.
  if (!existing) void track(PRODUCT_EVENT.FUNNEL_CREATED, { workspaceId, metadata: { slug: doc.slug } });
  if (published) void track(PRODUCT_EVENT.FUNNEL_PUBLISHED, { workspaceId, metadata: { slug: doc.slug } });
  return saved;
}

/** Delete a funnel the workspace owns. Returns true if a row was removed. */
export async function deleteFunnel(workspaceId: string, slug: string): Promise<boolean> {
  const r = await pgPool().query("DELETE FROM qual_funnels WHERE slug = $1 AND workspace_id = $2", [slug, workspaceId]);
  return (r.rowCount ?? 0) > 0;
}

/**
 * Resolve a slug to the runtime config the public routes serve. A published
 * stored funnel wins; otherwise the built-in demo; otherwise null. This is the
 * single entry point the /q routes use instead of getQualFunnel directly.
 */
export async function resolveFunnelConfig(slug: string): Promise<QualFunnelConfig | null> {
  const stored = await getStoredFunnel(slug);
  if (stored && stored.published) return compileFunnel(stored.doc);
  return getQualFunnel(slug); // demo fallback (or null)
}
