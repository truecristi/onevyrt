/**
 * Author-scoped reads for community comments — everything one workspace has
 * itself POSTED, across every artifact it commented on (its own or anyone
 * else's), rather than comments.ts's artifact-scoped listComments(), which
 * only answers "who said what on artifact X". Same table, same row shape
 * (CommunityComment) — just filtered by author_workspace_id instead of
 * (artifact_type, artifact_id), which the table already indexes (see the
 * community_comments migration).
 *
 * This closes the data-export gap called out in comments.ts's file header
 * and app/api/account/export/route.ts: a workspace could see everything it
 * had *published* to the hub (lib/community/authors.ts), but had no way to
 * see comments it left on OTHER workspaces' shared templates/creatives.
 * Newest-first (unlike listComments' oldest-first thread order), since this
 * reads as "my activity", not a conversation.
 */
import { pgPool } from "../db";
import type { ArtifactType, CommunityComment } from "./comments";

const SELECT = "id, artifact_type, artifact_id, author_workspace_id, author_name, body, created_at";

function rowToComment(r: Record<string, unknown>): CommunityComment {
  return {
    id: r.id as string, artifactType: r.artifact_type as ArtifactType, artifactId: r.artifact_id as string,
    authorWorkspaceId: r.author_workspace_id as string, authorName: (r.author_name as string) ?? null,
    body: r.body as string, createdAt: new Date(r.created_at as string).toISOString(),
  };
}

/** Every comment this workspace has left, on any artifact of any type,
 *  newest first. */
export async function listCommentsByAuthor(authorWorkspaceId: string, limit = 200): Promise<CommunityComment[]> {
  const r = await pgPool().query(
    `SELECT ${SELECT} FROM community_comments WHERE author_workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [authorWorkspaceId, limit],
  );
  return r.rows.map(rowToComment);
}

/** Comments this workspace has left on artifacts of one type (all templates,
 *  or all creatives), newest first. */
export async function listCommentsByAuthorOnArtifact(authorWorkspaceId: string, artifactType: ArtifactType, limit = 200): Promise<CommunityComment[]> {
  const r = await pgPool().query(
    `SELECT ${SELECT} FROM community_comments WHERE author_workspace_id = $1 AND artifact_type = $2 ORDER BY created_at DESC LIMIT $3`,
    [authorWorkspaceId, artifactType, limit],
  );
  return r.rows.map(rowToComment);
}
