/**
 * Author-scoped reads for community reactions — every "helpful" endorsement
 * one workspace has left on any shared artifact, its own or anyone else's.
 * Mirrors reactions.ts's artifact-scoped reactionStates(), which only
 * answers "who endorsed artifact X" — this flips the filter to workspace_id
 * instead of (artifact_type, artifact_id).
 *
 * community_reactions (see its migration) has no surrogate id — its primary
 * key is the composite (artifact_type, artifact_id, workspace_id) — and no
 * `type` column: every row already IS a "helpful" endorsement, the only kind
 * this app records. `reactionType` exists on the exported type/signature for
 * forward compatibility with a future second reaction kind; today the only
 * legal value is "helpful" (or omitted), and `id` below is synthesized from
 * the composite key rather than read from a column.
 *
 * Closes the data-export gap called out in reactions.ts's file header and
 * app/api/account/export/route.ts: a workspace could see the "helpful"
 * counts on things it published, but had no way to see reactions IT left on
 * OTHER workspaces' shared templates/creatives.
 */
import { pgPool } from "../db";
import type { ArtifactType } from "./comments";

/** The only reaction kind this app records today — see file header. */
export type ReactionType = "helpful";

export interface AuthoredReaction {
  /** Synthesized from the composite key (community_reactions has no id column). */
  id: string;
  artifactType: ArtifactType;
  artifactId: string;
  reactionType: ReactionType;
  createdAt: string;
}

function rowToReaction(r: Record<string, unknown>): AuthoredReaction {
  const artifactType = r.artifact_type as ArtifactType;
  const artifactId = r.artifact_id as string;
  const workspaceId = r.workspace_id as string;
  return {
    id: `${artifactType}:${artifactId}:${workspaceId}`,
    artifactType,
    artifactId,
    reactionType: "helpful",
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

/** Every "helpful" reaction this workspace has left, on any artifact, newest
 *  first. `reactionType`, if passed, must be "helpful" (the only kind this
 *  app records today) — anything else returns no rows rather than silently
 *  ignoring the filter. */
export async function listReactionsByAuthor(authorWorkspaceId: string, reactionType?: ReactionType, limit = 200): Promise<AuthoredReaction[]> {
  if (reactionType && reactionType !== "helpful") return [];
  const r = await pgPool().query(
    "SELECT artifact_type, artifact_id, workspace_id, created_at FROM community_reactions WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2",
    [authorWorkspaceId, limit],
  );
  return r.rows.map(rowToReaction);
}
