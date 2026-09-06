/**
 * Store for community-shared funnel templates. A workspace publishes a funnel's
 * doc as a public template; anyone can list the gallery, fetch one to copy, and
 * the copy bumps a use counter. The author can unpublish their own. The doc is
 * validated on publish so a broken template never reaches the gallery, and its
 * slug is stripped (a slug is assigned when someone copies it).
 */
import { randomUUID } from "node:crypto";
import { pgPool } from "../db";
import { validateFunnelDoc, type FunnelDoc } from "./funnel-builder";

export interface SharedTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  authorWorkspaceId: string;
  authorName: string | null;
  uses: number;
  createdAt: string;
}
export interface SharedTemplateFull extends SharedTemplate { doc: FunnelDoc }

function rowToMeta(r: Record<string, unknown>): SharedTemplate {
  return {
    id: r.id as string, name: r.name as string, description: (r.description as string) ?? null,
    category: (r.category as string) ?? null, authorWorkspaceId: r.author_workspace_id as string,
    authorName: (r.author_name as string) ?? null,
    uses: Number(r.uses) || 0, createdAt: new Date(r.created_at as string).toISOString(),
  };
}

/** Publish a funnel doc as a public template. Validates first. Returns the
 *  published template's metadata. `authorName` is the public display name to
 *  credit (snapshotted, so it survives a later name change). */
export async function publishTemplate(authorWorkspaceId: string, input: { name: string; description?: string; category?: string; doc: FunnelDoc; authorName?: string }): Promise<SharedTemplate> {
  const name = (input.name || "").trim();
  if (!name) throw new Error("a template name is required");
  // A template carries no live slug (a copy gets a fresh one), so validate the
  // structure against a placeholder slug, then store it slug-less.
  const err = validateFunnelDoc({ ...structuredClone(input.doc), slug: "template" });
  if (err) throw new Error(err);
  const doc: FunnelDoc = { ...structuredClone(input.doc), slug: "" };
  const id = randomUUID();
  const r = await pgPool().query(
    `INSERT INTO shared_templates (id, author_workspace_id, author_name, name, description, category, doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, author_workspace_id, author_name, name, description, category, uses, created_at`,
    [id, authorWorkspaceId, (input.authorName ?? "").slice(0, 40) || null, name.slice(0, 120), (input.description ?? "").slice(0, 400) || null, (input.category ?? "").slice(0, 40) || null, JSON.stringify(doc)],
  );
  return rowToMeta(r.rows[0]);
}

/** The gallery — published templates, most-used then newest first. */
export async function listSharedTemplates(limit = 60): Promise<SharedTemplate[]> {
  const r = await pgPool().query(
    "SELECT id, author_workspace_id, author_name, name, description, category, uses, created_at FROM shared_templates ORDER BY uses DESC, created_at DESC LIMIT $1",
    [limit],
  );
  return r.rows.map(rowToMeta);
}

/** Templates a specific workspace has shared, newest first — for their
 *  community profile. */
export async function listTemplatesByAuthor(authorWorkspaceId: string, limit = 60): Promise<SharedTemplate[]> {
  const r = await pgPool().query(
    "SELECT id, author_workspace_id, author_name, name, description, category, uses, created_at FROM shared_templates WHERE author_workspace_id = $1 ORDER BY created_at DESC LIMIT $2",
    [authorWorkspaceId, limit],
  );
  return r.rows.map(rowToMeta);
}

/** One template with its full doc — for copying into a builder. */
export async function getSharedTemplate(id: string): Promise<SharedTemplateFull | null> {
  const r = await pgPool().query("SELECT id, author_workspace_id, author_name, name, description, category, uses, created_at, doc FROM shared_templates WHERE id = $1", [id]);
  if (!r.rows[0]) return null;
  return { ...rowToMeta(r.rows[0]), doc: r.rows[0].doc as FunnelDoc };
}

/** Bump the use counter when a template is copied. Best-effort.
 *
 *  `workspaceId`, when given, dedupes: the counter only moves the first time
 *  that workspace uses this template (mirrors community_reactions's
 *  composite-key one-per-workspace pattern via community_artifact_uses), so
 *  an author can't inflate their own item's popularity by looping the call.
 *  Omitted, this falls back to the old unconditional increment — kept for
 *  callers that don't have a workspace to dedupe against. */
export async function recordTemplateUse(id: string, workspaceId?: string): Promise<void> {
  if (workspaceId) {
    await pgPool().query(
      `WITH ins AS (
         INSERT INTO community_artifact_uses (artifact_type, artifact_id, workspace_id)
         VALUES ('template', $1, $2)
         ON CONFLICT DO NOTHING
         RETURNING 1
       )
       UPDATE shared_templates SET uses = uses + 1 WHERE id = $1 AND EXISTS (SELECT 1 FROM ins)`,
      [id, workspaceId],
    );
    return;
  }
  await pgPool().query("UPDATE shared_templates SET uses = uses + 1 WHERE id = $1", [id]);
}

/** Unpublish a template the workspace authored. Returns true if removed. */
export async function unpublishTemplate(authorWorkspaceId: string, id: string): Promise<boolean> {
  const r = await pgPool().query("DELETE FROM shared_templates WHERE id = $1 AND author_workspace_id = $2", [id, authorWorkspaceId]);
  return (r.rowCount ?? 0) > 0;
}

/** Admin override: unpublish any template by id, bypassing the author check.
 *  Callers MUST gate this behind requireAdmin(); it's used only by the admin
 *  API. Returns the deleted template (for an audit trail), or null if none
 *  existed. */
export async function adminUnpublishTemplate(id: string): Promise<SharedTemplate | null> {
  const r = await pgPool().query(
    "DELETE FROM shared_templates WHERE id = $1 RETURNING id, author_workspace_id, author_name, name, description, category, uses, created_at",
    [id],
  );
  return r.rows[0] ? rowToMeta(r.rows[0]) : null;
}
