/**
 * Community identity — the public display name a workspace shares artifacts
 * under. Stored per workspace in community_profiles; when unset, we derive a
 * friendly default from the owner's email handle (never the full address). The
 * resolved name is snapshotted onto each shared artifact at publish time, so
 * "Shared by <name>" needs no join and survives a later name change.
 */
import { pgPool } from "../db";
import { getWorkspace } from "../workspaces";
import { getUserById } from "../auth";

const MAX = 40;

/** Turn an email into a friendly handle: truecristi@gmail.com -> "Truecristi". */
function handleFromEmail(email: string): string {
  const local = (email.split("@")[0] || "owner").replace(/[._-]+/g, " ").trim();
  const cleaned = local.replace(/\s+/g, " ").slice(0, MAX) || "owner";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** The explicitly-set community name for a workspace, or null if never set. */
export async function getProfileName(workspaceId: string): Promise<string | null> {
  const r = await pgPool().query("SELECT display_name FROM community_profiles WHERE workspace_id = $1", [workspaceId]);
  return r.rows[0] ? (r.rows[0].display_name as string) : null;
}

/** The name this workspace shares under: its set name, else a default derived
 *  from the owner's email handle. Always returns something usable. */
export async function resolveDisplayName(workspaceId: string): Promise<string> {
  const set = await getProfileName(workspaceId);
  if (set) return set;
  const ws = await getWorkspace(workspaceId);
  if (ws) {
    const owner = await getUserById(ws.ownerId);
    if (owner?.email) return handleFromEmail(owner.email);
  }
  return "An owner";
}

/** Set (or clear) a workspace's community display name. Returns the stored
 *  name, or the resolved default after a clear. */
export async function setProfileName(workspaceId: string, name: string): Promise<string> {
  const clean = (name || "").trim().slice(0, MAX);
  if (!clean) {
    await pgPool().query("DELETE FROM community_profiles WHERE workspace_id = $1", [workspaceId]);
    return resolveDisplayName(workspaceId);
  }
  await pgPool().query(
    `INSERT INTO community_profiles (workspace_id, display_name, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (workspace_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
    [workspaceId, clean],
  );
  return clean;
}
