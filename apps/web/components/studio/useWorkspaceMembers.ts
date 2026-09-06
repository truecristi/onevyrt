/**
 * Workspace members slice of the Studio — the invite form (email + role) and
 * add/remove-member handlers behind the Members panel. Extracted from
 * funnel-studio.tsx as a self-contained hook: it needs only the active
 * workspace id and a way to refresh the workspace list (so a membership change
 * reflects immediately), and owns the small invite form state. Second increment
 * of the funnel-studio decomposition; same hook-per-slice pattern as
 * useApiKeysAndWebhooks.
 */
import { useCallback, useState } from "react";
import { confirmDialog } from "../Modal";

export type MemberRole = "manager" | "editor" | "viewer";

export function useWorkspaceMembers(activeWsId: string, refreshWorkspaces: () => Promise<void>) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("editor");
  const [inviteMsg, setInviteMsg] = useState("");

  const invite = useCallback(async () => {
    if (!activeWsId || !inviteEmail.trim()) return;
    setInviteMsg("");
    try {
      const r = await fetch(`/api/workspaces/${encodeURIComponent(activeWsId)}/members`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }) });
      const data = await r.json() as { error?: string };
      if (!r.ok) { setInviteMsg(data.error ?? "Invite failed."); return; }
      setInviteEmail(""); setInviteMsg("Added ✓"); await refreshWorkspaces();
    } catch { setInviteMsg("Network error."); }
  }, [activeWsId, inviteEmail, inviteRole, refreshWorkspaces]);

  const removeWsMember = useCallback(async (targetUserId: string) => {
    if (!activeWsId) return;
    // Removing a member revokes their access — confirm before doing it.
    if (!(await confirmDialog({ title: "Remove this member?", message: "They'll lose access to this workspace. You can re-invite them later.", danger: true, confirmLabel: "Remove" }))) return;
    setInviteMsg("");
    try {
      const r = await fetch(`/api/workspaces/${encodeURIComponent(activeWsId)}/members?userId=${encodeURIComponent(targetUserId)}`, { method: "DELETE" });
      const data = await r.json() as { error?: string };
      if (!r.ok) { setInviteMsg(data.error ?? "Could not remove member."); return; }
      await refreshWorkspaces();
    } catch { setInviteMsg("Network error."); }
  }, [activeWsId, refreshWorkspaces]);

  return { inviteEmail, setInviteEmail, inviteRole, setInviteRole, inviteMsg, invite, removeWsMember };
}
