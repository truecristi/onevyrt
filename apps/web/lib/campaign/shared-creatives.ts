/**
 * Store for the community swipe file — ad creatives a workspace has shared for
 * anyone to copy. A shared creative is just ad copy (headline, primary text,
 * CTA, angle) plus the predicted score — no leads, no attribution, no funnel
 * link. Listing returns the full record (it's small), copying bumps a use
 * counter, and the author can unpublish their own.
 */
import { randomUUID } from "node:crypto";
import { pgPool } from "../db";

export interface SharedCreative {
  id: string;
  authorWorkspaceId: string;
  authorName: string | null;
  headline: string;
  primaryText: string | null;
  cta: string | null;
  angle: string | null;
  score: number;
  uses: number;
  createdAt: string;
}

export interface PublishCreativeInput {
  headline: string;
  primaryText?: string;
  cta?: string;
  angle?: string;
  score?: number;
  authorName?: string;
}

function rowToCreative(r: Record<string, unknown>): SharedCreative {
  return {
    id: r.id as string, authorWorkspaceId: r.author_workspace_id as string,
    authorName: (r.author_name as string) ?? null,
    headline: r.headline as string, primaryText: (r.primary_text as string) ?? null,
    cta: (r.cta as string) ?? null, angle: (r.angle as string) ?? null,
    score: Number(r.score) || 0, uses: Number(r.uses) || 0,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

/** Publish an ad creative to the community swipe file. `authorName` is the
 *  public display name to credit (snapshotted). Returns the record. */
export async function publishCreative(authorWorkspaceId: string, input: PublishCreativeInput): Promise<SharedCreative> {
  const headline = (input.headline || "").trim();
  if (!headline) throw new Error("a headline is required");
  const id = randomUUID();
  const r = await pgPool().query(
    `INSERT INTO shared_creatives (id, author_workspace_id, author_name, headline, primary_text, cta, angle, score)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, author_workspace_id, author_name, headline, primary_text, cta, angle, score, uses, created_at`,
    [id, authorWorkspaceId, (input.authorName ?? "").slice(0, 40) || null, headline.slice(0, 300), (input.primaryText ?? "").slice(0, 2000) || null,
      (input.cta ?? "").slice(0, 120) || null, (input.angle ?? "").slice(0, 80) || null,
      Math.max(0, Math.min(100, Math.round(input.score ?? 0)))],
  );
  return rowToCreative(r.rows[0]);
}

/** The swipe file — shared creatives, most-copied then newest first. */
export async function listSharedCreatives(limit = 60): Promise<SharedCreative[]> {
  const r = await pgPool().query(
    "SELECT id, author_workspace_id, author_name, headline, primary_text, cta, angle, score, uses, created_at FROM shared_creatives ORDER BY uses DESC, created_at DESC LIMIT $1",
    [limit],
  );
  return r.rows.map(rowToCreative);
}

/** Creatives a specific workspace has shared, newest first — for their
 *  community profile. */
export async function listCreativesByAuthor(authorWorkspaceId: string, limit = 60): Promise<SharedCreative[]> {
  const r = await pgPool().query(
    "SELECT id, author_workspace_id, author_name, headline, primary_text, cta, angle, score, uses, created_at FROM shared_creatives WHERE author_workspace_id = $1 ORDER BY created_at DESC LIMIT $2",
    [authorWorkspaceId, limit],
  );
  return r.rows.map(rowToCreative);
}

/** Bump the use counter when a creative is copied. Best-effort.
 *
 *  `workspaceId`, when given, dedupes: the counter only moves the first time
 *  that workspace uses this creative (mirrors community_reactions's
 *  composite-key one-per-workspace pattern via community_artifact_uses), so
 *  an author can't inflate their own item's popularity by looping the call.
 *  Omitted, this falls back to the old unconditional increment — kept for
 *  callers that don't have a workspace to dedupe against. */
export async function recordCreativeUse(id: string, workspaceId?: string): Promise<void> {
  if (workspaceId) {
    await pgPool().query(
      `WITH ins AS (
         INSERT INTO community_artifact_uses (artifact_type, artifact_id, workspace_id)
         VALUES ('creative', $1, $2)
         ON CONFLICT DO NOTHING
         RETURNING 1
       )
       UPDATE shared_creatives SET uses = uses + 1 WHERE id = $1 AND EXISTS (SELECT 1 FROM ins)`,
      [id, workspaceId],
    );
    return;
  }
  await pgPool().query("UPDATE shared_creatives SET uses = uses + 1 WHERE id = $1", [id]);
}

/** Unpublish a creative the workspace authored. Returns true if removed. */
export async function unpublishCreative(authorWorkspaceId: string, id: string): Promise<boolean> {
  const r = await pgPool().query("DELETE FROM shared_creatives WHERE id = $1 AND author_workspace_id = $2", [id, authorWorkspaceId]);
  return (r.rowCount ?? 0) > 0;
}

/** Admin override: unpublish any creative by id, bypassing the author check.
 *  Callers MUST gate this behind requireAdmin(); it's used only by the admin
 *  API. Returns the deleted creative (for an audit trail), or null if none
 *  existed. */
export async function adminUnpublishCreative(id: string): Promise<SharedCreative | null> {
  const r = await pgPool().query(
    "DELETE FROM shared_creatives WHERE id = $1 RETURNING id, author_workspace_id, author_name, headline, primary_text, cta, angle, score, uses, created_at",
    [id],
  );
  return r.rows[0] ? rowToCreative(r.rows[0]) : null;
}
