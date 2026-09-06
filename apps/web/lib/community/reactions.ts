/**
 * Store for community reactions — a single "helpful" (👍) endorsement per
 * workspace per shared artifact. Toggling adds or removes the caller's
 * endorsement; state is fetched in bulk so the hub can render every tile's
 * count and whether the caller reacted in one query.
 */
import { pgPool } from "../db";
import type { ArtifactType } from "./comments";

export interface ReactionState { count: number; mine: boolean }

/** Toggle the caller's endorsement of an artifact. Returns the new state. */
export async function toggleReaction(workspaceId: string, artifactType: ArtifactType, artifactId: string): Promise<ReactionState> {
  const existing = await pgPool().query(
    "DELETE FROM community_reactions WHERE artifact_type = $1 AND artifact_id = $2 AND workspace_id = $3",
    [artifactType, artifactId, workspaceId],
  );
  let mine: boolean;
  if ((existing.rowCount ?? 0) > 0) {
    mine = false; // was reacted → removed
  } else {
    await pgPool().query(
      "INSERT INTO community_reactions (artifact_type, artifact_id, workspace_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [artifactType, artifactId, workspaceId],
    );
    mine = true;
  }
  const c = await pgPool().query(
    "SELECT COUNT(*)::int AS n FROM community_reactions WHERE artifact_type = $1 AND artifact_id = $2",
    [artifactType, artifactId],
  );
  return { count: Number(c.rows[0]?.n) || 0, mine };
}

/** Reaction state for a batch of artifacts of one type — {id: {count, mine}}.
 *  Empty input returns an empty map (no query). */
export async function reactionStates(workspaceId: string, artifactType: ArtifactType, artifactIds: string[]): Promise<Record<string, ReactionState>> {
  if (artifactIds.length === 0) return {};
  const r = await pgPool().query(
    `SELECT artifact_id,
            COUNT(*)::int AS n,
            bool_or(workspace_id = $1) AS mine
     FROM community_reactions
     WHERE artifact_type = $2 AND artifact_id = ANY($3)
     GROUP BY artifact_id`,
    [workspaceId, artifactType, artifactIds],
  );
  const out: Record<string, ReactionState> = {};
  for (const row of r.rows) out[row.artifact_id as string] = { count: Number(row.n) || 0, mine: !!row.mine };
  return out;
}
