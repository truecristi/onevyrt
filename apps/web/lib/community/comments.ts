/**
 * Store for community comments — discussion on a shared artifact. An artifact
 * is addressed by (type, id) where type is 'template' or 'creative'. Comments
 * snapshot the author's community display name (same credit model as the
 * artifacts). Listing is oldest-first (a thread reads top to bottom); counts
 * are fetched in bulk so the hub can badge every tile in one query.
 */
import { randomUUID } from "node:crypto";
import { pgPool } from "../db";

export type ArtifactType = "template" | "creative";
export function isArtifactType(v: unknown): v is ArtifactType { return v === "template" || v === "creative"; }

export interface CommunityComment {
  id: string;
  artifactType: ArtifactType;
  artifactId: string;
  authorWorkspaceId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}

const MAX_BODY = 1000;

function rowToComment(r: Record<string, unknown>): CommunityComment {
  return {
    id: r.id as string, artifactType: r.artifact_type as ArtifactType, artifactId: r.artifact_id as string,
    authorWorkspaceId: r.author_workspace_id as string, authorName: (r.author_name as string) ?? null,
    body: r.body as string, createdAt: new Date(r.created_at as string).toISOString(),
  };
}

/** Post a comment on an artifact. Returns the stored comment. */
export async function addComment(authorWorkspaceId: string, authorName: string | null, artifactType: ArtifactType, artifactId: string, body: string): Promise<CommunityComment> {
  const clean = (body || "").trim();
  if (!clean) throw new Error("a comment can't be empty");
  const id = randomUUID();
  const r = await pgPool().query(
    `INSERT INTO community_comments (id, artifact_type, artifact_id, author_workspace_id, author_name, body)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, artifact_type, artifact_id, author_workspace_id, author_name, body, created_at`,
    [id, artifactType, artifactId, authorWorkspaceId, (authorName ?? "").slice(0, 40) || null, clean.slice(0, MAX_BODY)],
  );
  return rowToComment(r.rows[0]);
}

/** A thread for one artifact, oldest first. */
export async function listComments(artifactType: ArtifactType, artifactId: string, limit = 200): Promise<CommunityComment[]> {
  const r = await pgPool().query(
    "SELECT id, artifact_type, artifact_id, author_workspace_id, author_name, body, created_at FROM community_comments WHERE artifact_type = $1 AND artifact_id = $2 ORDER BY created_at ASC LIMIT $3",
    [artifactType, artifactId, limit],
  );
  return r.rows.map(rowToComment);
}

/** Comment counts for a batch of artifact ids of one type — {id: count}. Empty
 *  input returns an empty map (avoids a needless query). */
export async function commentCounts(artifactType: ArtifactType, artifactIds: string[]): Promise<Record<string, number>> {
  if (artifactIds.length === 0) return {};
  const r = await pgPool().query(
    "SELECT artifact_id, COUNT(*)::int AS n FROM community_comments WHERE artifact_type = $1 AND artifact_id = ANY($2) GROUP BY artifact_id",
    [artifactType, artifactIds],
  );
  const out: Record<string, number> = {};
  for (const row of r.rows) out[row.artifact_id as string] = Number(row.n) || 0;
  return out;
}

/** Delete a comment the workspace authored. Returns true if one was removed. */
export async function deleteComment(authorWorkspaceId: string, id: string): Promise<boolean> {
  const r = await pgPool().query("DELETE FROM community_comments WHERE id = $1 AND author_workspace_id = $2", [id, authorWorkspaceId]);
  return (r.rowCount ?? 0) > 0;
}

/** Admin override: delete any comment by id, bypassing the author check —
 *  the moderation path for content its author won't remove themselves.
 *  Callers MUST gate this behind requireAdmin(); it's used only by the admin
 *  API. Returns the deleted comment (for an audit trail), or null if none
 *  existed. */
export async function adminDeleteComment(id: string): Promise<CommunityComment | null> {
  const r = await pgPool().query(
    "DELETE FROM community_comments WHERE id = $1 RETURNING id, artifact_type, artifact_id, author_workspace_id, author_name, body, created_at",
    [id],
  );
  return r.rows[0] ? rowToComment(r.rows[0]) : null;
}
