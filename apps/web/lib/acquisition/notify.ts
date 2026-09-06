/**
 * Acquisition notifications — bridge a public funnel event (a qualified lead,
 * a booked call) to the in-app bell for the workspace that owns the funnel.
 * Resolves the funnel's owning workspace, then notifies every member. Public
 * funnel routes have no signed-in user, so this is how the owner finds out.
 * Best-effort and never throws — a notification hiccup must not break the
 * visitor's flow.
 */
import { funnelOwner } from "./leads";
import { getWorkspace } from "../workspaces";
import { createNotification } from "../notifications";

export async function notifyFunnelWorkspace(funnelSlug: string, n: { type: string; title: string; body: string; linkUrl?: string; dedupeKey?: string }): Promise<void> {
  try {
    const wsId = await funnelOwner(funnelSlug);
    if (!wsId) return; // unowned funnel (e.g. unclaimed demo) — nobody to tell
    const ws = await getWorkspace(wsId);
    if (!ws) return;
    const memberIds = new Set<string>([ws.ownerId, ...ws.members.map((m) => m.userId)]);
    for (const userId of memberIds) {
      await createNotification({
        userId, workspaceId: wsId, type: n.type, title: n.title, body: n.body, linkUrl: n.linkUrl,
        // Per-recipient dedupe so re-delivery never double-notifies the same person.
        dedupeKey: n.dedupeKey ? `${n.dedupeKey}:${userId}` : undefined,
      });
    }
  } catch { /* notifications are best effort */ }
}
